import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditTrailService } from '../billing/audit-trail.service';
import { MonitoringDefinition } from '../equipment/equipment.entity';
import {
  EquipmentAccessService,
  MonitoringService,
} from '../monitoring/monitoring.service';
import {
  Actor,
  currency,
  decimal,
  instant,
  optionalText,
  pageParams,
  requiredText,
} from './operations.util';

type Plan = {
  id: string;
  equipment_id: string;
  title: string;
  trigger_type: 'CALENDAR' | 'HOURS' | 'BOTH';
  interval_days: number | null;
  interval_hours: string | null;
  reference_service_at: Date | null;
  reference_hours: string | null;
  reminder_days: number;
  reminder_hours: string;
  is_active: boolean;
};

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly db: DataSource,
    private readonly access: EquipmentAccessService,
    private readonly monitoring: MonitoringService,
    private readonly auditTrail: AuditTrailService,
  ) {}
  private async rows<T>(sql: string, args: unknown[] = []): Promise<T[]> {
    const result: unknown = await this.db.query(sql, args);
    return (
      /^\s*UPDATE/i.test(sql) &&
      Array.isArray(result) &&
      Array.isArray(result[0])
        ? result[0]
        : result
    ) as T[];
  }

  async list(actor: Actor, query: Record<string, unknown>) {
    const ids = await this.access.ids(actor.sub);
    const scoped = query.equipmentId
      ? ids.filter((id) => id === query.equipmentId)
      : ids;
    if (query.equipmentId && !scoped.length)
      throw new NotFoundException('Equipment not found');
    if (!scoped.length)
      return {
        plans: [] as Array<{
          id: string;
          equipment_id: string;
          title: string;
          status: { state: string; nextDueAt: Date | null };
        }>,
        services: [],
        page: 1,
        pageSize: 25,
        total: 0,
      };
    const { take, skip, page, pageSize } = pageParams(
      query.page,
      query.pageSize,
    );
    const plans = await this.rows<Plan>(
      `SELECT p.* FROM maintenance_plans p JOIN equipment e ON e.id=p.equipment_id WHERE p.equipment_id=ANY($1::uuid[]) AND ($2::uuid IS NULL OR e.site_id=$2) ORDER BY p.created_at DESC`,
      [scoped, query.siteId || null],
    );
    const enriched = await Promise.all(
      plans.map(async (plan) => ({
        ...plan,
        status: await this.status(actor, plan),
      })),
    );
    const filtered = query.status
      ? enriched.filter((row) => row.status.state === query.status)
      : enriched;
    const services = await this.rows(
      `SELECT s.* FROM service_records s JOIN equipment e ON e.id=s.equipment_id WHERE s.equipment_id=ANY($1::uuid[]) AND ($2::uuid IS NULL OR e.site_id=$2) AND s.voided_at IS NULL ORDER BY s.performed_at DESC,s.id DESC LIMIT $3 OFFSET $4`,
      [scoped, query.siteId || null, take, skip],
    );
    return {
      plans: filtered,
      services,
      page,
      pageSize,
      total: filtered.length,
      upcoming: filtered.filter((row) => row.status.state === 'DUE_SOON')
        .length,
      overdue: filtered.filter((row) => row.status.state === 'OVERDUE').length,
    };
  }

  private async status(actor: Actor, plan: Plan) {
    const equipment = await this.access.one(actor.sub, plan.equipment_id);
    const now = new Date();
    let nextDueAt: Date | null = null,
      daysRemaining: number | null = null,
      hoursRemaining: number | null = null,
      unknownMs = 0,
      hourEvidenceMissing = false;
    if (
      (plan.trigger_type === 'CALENDAR' || plan.trigger_type === 'BOTH') &&
      plan.reference_service_at &&
      plan.interval_days
    ) {
      nextDueAt = new Date(
        new Date(plan.reference_service_at).getTime() +
          plan.interval_days * 86400000,
      );
      daysRemaining = (nextDueAt.getTime() - now.getTime()) / 86400000;
    }
    if (
      (plan.trigger_type === 'HOURS' || plan.trigger_type === 'BOTH') &&
      plan.reference_service_at &&
      plan.interval_hours
    ) {
      if (equipment.monitoringDefinition) {
        const metrics = await this.monitoring.metrics(
          equipment,
          new Date(plan.reference_service_at),
          now,
          equipment.site.timezone,
        );
        hoursRemaining = Number(plan.interval_hours) - metrics.onMs / 3600000;
        unknownMs = metrics.unknownMs;
        hourEvidenceMissing = metrics.eligibleMs === 0;
      }
    }
    const calendarDue = daysRemaining !== null && daysRemaining <= 0;
    const hoursDue = hoursRemaining !== null && hoursRemaining <= 0;
    const calendarSoon =
      daysRemaining !== null && daysRemaining <= plan.reminder_days;
    const hoursSoon =
      hoursRemaining !== null && hoursRemaining <= Number(plan.reminder_hours);
    let state = 'SCHEDULED';
    if (!plan.is_active) state = 'INACTIVE';
    else if (calendarDue && daysRemaining !== null && daysRemaining < -1)
      state = 'OVERDUE';
    else if (calendarDue || hoursDue) state = 'DUE';
    else if (calendarSoon || hoursSoon) state = 'DUE_SOON';
    else if (
      plan.trigger_type !== 'CALENDAR' &&
      (hoursRemaining === null || unknownMs > 0 || hourEvidenceMissing)
    )
      state = 'UNABLE_TO_DETERMINE';
    return {
      state,
      nextDueAt,
      daysRemaining,
      hoursRemaining,
      unknownMs,
      hourBasis:
        equipment.monitoringDefinition === MonitoringDefinition.ENGINE_RUNNING
          ? 'Observed engine-running hours'
          : equipment.monitoringDefinition ===
              MonitoringDefinition.OUTPUT_POWER_PRESENT
            ? 'Observed output-powered hours'
            : 'No configured hour basis',
      warning: hourEvidenceMissing
        ? 'No eligible monitoring interval confirms operating hours since the reference service'
        : unknownMs > 0
          ? 'Unknown monitoring intervals may hide additional operating hours'
          : null,
    };
  }

  async createPlan(actor: Actor, body: Record<string, unknown>) {
    if (actor.role !== 'Admin') throw new ForbiddenException();
    const equipment = await this.access.one(
      actor.sub,
      String(body.equipmentId),
    );
    const trigger = body.trigger;
    if (trigger !== 'CALENDAR' && trigger !== 'HOURS' && trigger !== 'BOTH')
      throw new BadRequestException('Invalid maintenance trigger');
    const days = trigger === 'HOURS' ? null : Number(body.intervalDays);
    const hours =
      trigger === 'CALENDAR'
        ? null
        : decimal(body.intervalHours, 'Hour interval', 3, true);
    if (days !== null && (!Number.isInteger(days) || days < 1 || days > 3650))
      throw new BadRequestException('Interval days must be 1–3650');
    if (hours && !equipment.monitoringDefinition)
      throw new BadRequestException(
        'Hour scheduling requires a monitoring definition',
      );
    const at = instant(body.referenceServiceAt, 'Reference service date');
    const [row] = await this.rows<Plan>(
      `INSERT INTO maintenance_plans(equipment_id,title,description,checklist,trigger_type,interval_days,interval_hours,reference_service_at,reference_hours,reminder_days,reminder_hours,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        equipment.id,
        requiredText(body.title, 'Plan title', 160),
        optionalText(body.description),
        optionalText(body.checklist),
        trigger,
        days,
        hours,
        at,
        body.referenceHours === undefined
          ? null
          : decimal(body.referenceHours, 'Reference hours'),
        Number(body.reminderDays ?? 7),
        decimal(body.reminderHours ?? '10', 'Reminder hours'),
        actor.sub,
      ],
    );
    await this.audit(actor, row.id, 'CREATE_PLAN', null, null, row);
    return { ...row, status: await this.status(actor, row) };
  }

  async updatePlan(actor: Actor, id: string, body: Record<string, unknown>) {
    if (actor.role !== 'Admin') throw new ForbiddenException();
    const [old] = await this.rows<Plan>(
      'SELECT * FROM maintenance_plans WHERE id=$1',
      [id],
    );
    if (!old) throw new NotFoundException('Plan not found');
    await this.access.one(actor.sub, old.equipment_id);
    const title =
      body.title === undefined
        ? old.title
        : requiredText(body.title, 'Plan title', 160);
    const active =
      body.isActive === undefined ? old.is_active : body.isActive === true;
    const [row] = await this.rows<Plan>(
      'UPDATE maintenance_plans SET title=$2,is_active=$3,description=$4,checklist=$5,updated_at=now() WHERE id=$1 RETURNING *',
      [
        id,
        title,
        active,
        body.description === undefined
          ? (old as unknown as { description: string | null }).description
          : optionalText(body.description),
        body.checklist === undefined
          ? (old as unknown as { checklist: string | null }).checklist
          : optionalText(body.checklist),
      ],
    );
    await this.audit(
      actor,
      id,
      'UPDATE_PLAN',
      requiredText(body.reason, 'Change reason', 1000),
      old,
      row,
    );
    return { ...row, status: await this.status(actor, row) };
  }

  async service(actor: Actor, body: Record<string, unknown>) {
    const equipment = await this.access.one(
      actor.sub,
      String(body.equipmentId),
    );
    const performed = instant(body.performedAt, 'Service time');
    const planId = typeof body.planId === 'string' ? body.planId : null;
    let plan: Plan | null = null;
    if (planId) {
      plan =
        (
          await this.rows<Plan>(
            'SELECT * FROM maintenance_plans WHERE id=$1 AND equipment_id=$2',
            [planId, equipment.id],
          )
        )[0] ?? null;
      if (!plan)
        throw new BadRequestException('Plan does not belong to this equipment');
    }
    if (body.resetsPlanBaseline === true && !plan)
      throw new BadRequestException(
        'Select the plan whose baseline should reset',
      );
    const metrics = equipment.monitoringDefinition
      ? await this.monitoring.metrics(
          equipment,
          plan?.reference_service_at
            ? new Date(plan.reference_service_at)
            : performed,
          performed,
          equipment.site.timezone,
        )
      : null;
    const cost =
      body.cost === undefined || body.cost === ''
        ? null
        : decimal(body.cost, 'Service cost', 4);
    const [row] = await this.rows(
      `INSERT INTO service_records(equipment_id,maintenance_plan_id,performed_at,description,completed_checklist,technician,meter_hours,observed_hours,hour_basis,cost,currency,reference,notes,resets_plan_baseline,recorded_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [
        equipment.id,
        planId,
        performed,
        requiredText(body.description, 'Service description'),
        optionalText(body.completedChecklist),
        optionalText(body.technician, 160),
        body.meterHours === undefined || body.meterHours === ''
          ? null
          : decimal(body.meterHours, 'Physical meter hours'),
        metrics ? String(metrics.onMs / 3600000) : null,
        equipment.monitoringDefinition,
        cost,
        cost ? currency(body.currency ?? 'TZS') : null,
        optionalText(body.reference, 160),
        optionalText(body.notes),
        body.resetsPlanBaseline === true,
        actor.sub,
      ],
    );
    if (plan && body.resetsPlanBaseline === true)
      await this.rows(
        'UPDATE maintenance_plans SET reference_service_at=$2,reference_hours=$3,updated_at=now() WHERE id=$1',
        [
          plan.id,
          performed,
          body.meterHours === undefined || body.meterHours === ''
            ? plan.reference_hours
            : decimal(body.meterHours, 'Physical meter hours'),
        ],
      );
    await this.audit(
      actor,
      (row as { id: string }).id,
      'RECORD_SERVICE',
      null,
      null,
      row,
    );
    return row;
  }

  async voidService(actor: Actor, id: string, reason: unknown) {
    const [old] = await this.rows<{
      id: string;
      equipment_id: string;
      recorded_by: string;
      voided_at: Date | null;
      resets_plan_baseline: boolean;
    }>('SELECT * FROM service_records WHERE id=$1', [id]);
    if (!old) throw new NotFoundException('Service not found');
    const equipment = await this.access.one(actor.sub, old.equipment_id);
    if (actor.role !== 'Admin' && old.recorded_by !== actor.sub)
      throw new ForbiddenException('Only your own services can be corrected');
    if (old.voided_at) throw new BadRequestException('Already voided');
    if (old.resets_plan_baseline)
      throw new BadRequestException(
        'A baseline-resetting service needs explicit plan revision before voiding',
      );
    const why = requiredText(reason, 'Correction reason', 1000);
    const row = await this.db.transaction(async (manager) => {
      const result: unknown = await manager.query(
        'UPDATE service_records SET voided_at=now(),voided_by=$2,void_reason=$3 WHERE id=$1 AND voided_at IS NULL RETURNING *',
        [id, actor.sub, why],
      );
      const [record] = (
        Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result
      ) as Record<string, unknown>[];
      if (!record) throw new BadRequestException('Already voided');
      await manager.query(
        'INSERT INTO operational_audit(actor_id,entity_type,entity_id,action,reason,before_data,after_data) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [
          actor.sub,
          'maintenance',
          id,
          'VOID_SERVICE',
          why,
          JSON.stringify(old),
          JSON.stringify(record),
        ],
      );
      await this.auditTrail.record(
        {
          actorId: actor.sub,
          actorRole: actor.role,
          organizationId: equipment.organizationId,
          action: 'SERVICE_VOIDED',
          entityType: 'service_record',
          entityId: id,
          after: { status: 'VOID' },
          reason: why,
        },
        manager,
      );
      return record;
    });
    return { record: row, equipmentId: old.equipment_id };
  }

  async correctService(
    actor: Actor,
    id: string,
    body: Record<string, unknown>,
  ) {
    const [old] = await this.rows<Record<string, unknown>>(
      'SELECT * FROM service_records WHERE id=$1',
      [id],
    );
    if (!old) throw new NotFoundException('Service not found');
    const equipment = await this.access.one(
      actor.sub,
      String(old.equipment_id),
    );
    if (actor.role !== 'Admin' && old.recorded_by !== actor.sub)
      throw new ForbiddenException('Only your own services can be corrected');
    if (old.voided_at) throw new BadRequestException('Already voided');
    if (old.resets_plan_baseline)
      throw new BadRequestException(
        'Revise the plan baseline before correcting this service',
      );
    const why = requiredText(body.correctionReason, 'Correction reason', 1000);
    const performed = instant(body.performedAt, 'Service time');
    const cost =
      body.cost === undefined || body.cost === ''
        ? null
        : decimal(body.cost, 'Service cost', 4);
    const meter =
      body.meterHours === undefined || body.meterHours === ''
        ? null
        : decimal(body.meterHours, 'Physical meter hours');
    const sameTime =
      new Date(old.performed_at as Date).getTime() === performed.getTime();
    const record = await this.db.transaction(async (manager) => {
      const lockedResult: unknown = await manager.query(
        'SELECT voided_at FROM service_records WHERE id=$1 FOR UPDATE',
        [id],
      );
      const locked = lockedResult as { voided_at: Date | null }[];
      if (locked[0]?.voided_at) throw new BadRequestException('Already voided');
      const replacementResult: unknown = await manager.query(
        `INSERT INTO service_records(equipment_id,maintenance_plan_id,performed_at,description,completed_checklist,technician,meter_hours,observed_hours,hour_basis,cost,currency,reference,notes,resets_plan_baseline,recorded_by,corrected_from_id)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,false,$14,$15) RETURNING *`,
        [
          old.equipment_id,
          old.maintenance_plan_id,
          performed,
          requiredText(body.description, 'Service description'),
          optionalText(body.completedChecklist),
          optionalText(body.technician, 160),
          meter,
          sameTime ? old.observed_hours : null,
          sameTime ? old.hour_basis : null,
          cost,
          cost === null ? null : currency(body.currency ?? 'TZS'),
          optionalText(body.reference, 160),
          optionalText(body.notes),
          actor.sub,
          id,
        ],
      );
      const [replacement] = replacementResult as Record<string, unknown>[];
      await manager.query(
        'UPDATE service_records SET voided_at=now(),voided_by=$2,void_reason=$3 WHERE id=$1',
        [id, actor.sub, why],
      );
      await manager.query(
        'INSERT INTO operational_audit(actor_id,entity_type,entity_id,action,reason,before_data,after_data) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [
          actor.sub,
          'maintenance',
          id,
          'CORRECT_SERVICE',
          why,
          JSON.stringify(old),
          JSON.stringify(replacement),
        ],
      );
      await this.auditTrail.record(
        {
          actorId: actor.sub,
          actorRole: actor.role,
          organizationId: equipment.organizationId,
          action: 'SERVICE_CORRECTED',
          entityType: 'service_record',
          entityId: id,
          after: { status: 'CORRECTED' },
          reason: why,
        },
        manager,
      );
      return replacement;
    });
    return { record, equipmentId: String(old.equipment_id) };
  }

  private async audit(
    actor: Actor,
    id: string,
    action: string,
    reason: string | null,
    before: unknown,
    after: unknown,
  ) {
    await this.db.query(
      'INSERT INTO operational_audit(actor_id,entity_type,entity_id,action,reason,before_data,after_data) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [
        actor.sub,
        'maintenance',
        id,
        action,
        reason,
        before ? JSON.stringify(before) : null,
        after ? JSON.stringify(after) : null,
      ],
    );
    if (action === 'CREATE_PLAN' || action === 'UPDATE_PLAN') {
      const equipmentId = (after as { equipment_id?: string } | null)
        ?.equipment_id;
      if (equipmentId) {
        const [owner] = await this.rows<{ organization_id: string }>(
          'SELECT organization_id FROM equipment WHERE id=$1',
          [equipmentId],
        );
        await this.auditTrail.record({
          actorId: actor.sub,
          actorRole: actor.role,
          organizationId: owner?.organization_id,
          action:
            action === 'CREATE_PLAN'
              ? 'MAINTENANCE_PLAN_CREATED'
              : 'MAINTENANCE_PLAN_UPDATED',
          entityType: 'maintenance_plan',
          entityId: id,
          after: { status: 'UPDATED' },
          reason,
        });
      }
    }
  }
}
