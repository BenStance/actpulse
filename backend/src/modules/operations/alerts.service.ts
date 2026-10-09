import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EquipmentAccessService } from '../monitoring/monitoring.service';
import { MonitoringService } from '../monitoring/monitoring.service';
import { Equipment, EquipmentType } from '../equipment/equipment.entity';
import { ConnectivityService } from '../monitoring/connectivity.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import {
  Actor,
  decimal,
  optionalText,
  pageParams,
  requiredText,
} from './operations.util';

type Rule = {
  id: string;
  organization_id: string | null;
  equipment_id: string | null;
  type: string;
  severity: string;
  threshold: string | null;
  freshness_minutes: number | null;
  debounce_minutes: number;
  enabled: boolean;
  in_app: boolean;
  email: boolean;
};
type EquipmentRow = {
  id: string;
  organization_id: string;
  name: string;
  type: EquipmentType;
};

@Injectable()
export class AlertsService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private readonly logger = new Logger(AlertsService.name);
  constructor(
    private readonly db: DataSource,
    private readonly access: EquipmentAccessService,
    private readonly connectivity: ConnectivityService,
    private readonly realtime: RealtimeGateway,
    private readonly monitoring: MonitoringService,
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
  onModuleInit() {
    this.timer = setInterval(() => {
      void this.evaluateAll().catch((error) => this.logger.error(error));
    }, 60000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async list(actor: Actor, query: Record<string, unknown>) {
    const ids = await this.access.ids(actor.sub);
    if (!ids.length) return { items: [], total: 0, page: 1, pageSize: 25 };
    const { take, skip, page, pageSize } = pageParams(
      query.page,
      query.pageSize,
    );
    if (
      query.equipmentId &&
      (typeof query.equipmentId !== 'string' ||
        !ids.includes(query.equipmentId))
    )
      throw new NotFoundException('Equipment not found');
    const clauses = ['a.equipment_id=ANY($1::uuid[])'];
    const args: unknown[] = [ids];
    if (query.status) {
      args.push(query.status);
      clauses.push(`a.status=$${args.length}`);
    }
    if (query.severity) {
      args.push(query.severity);
      clauses.push(`a.severity=$${args.length}`);
    }
    if (query.equipmentId) {
      args.push(query.equipmentId);
      clauses.push(`a.equipment_id=$${args.length}`);
    }
    if (query.siteId) {
      args.push(query.siteId);
      clauses.push(`e.site_id=$${args.length}`);
    }
    const where = clauses.join(' AND ');
    const [counts, items] = await Promise.all([
      this.rows<{ total: string; open: string }>(
        `SELECT count(*)::text total,count(*) FILTER (WHERE a.status <> 'RESOLVED')::text open FROM alerts a JOIN equipment e ON e.id=a.equipment_id WHERE ${where}`,
        args,
      ),
      this.rows(
        `SELECT a.*,e.name equipment_name,e.site_id FROM alerts a JOIN equipment e ON e.id=a.equipment_id WHERE ${where} ORDER BY a.triggered_at DESC LIMIT $${args.length + 1} OFFSET $${args.length + 2}`,
        [...args, take, skip],
      ),
    ]);
    return {
      items,
      total: Number(counts[0]?.total || 0),
      open: Number(counts[0]?.open || 0),
      page,
      pageSize,
    };
  }

  async rules(actor: Actor, query: Record<string, unknown>) {
    const ids = await this.access.ids(actor.sub);
    if (actor.role === 'Admin')
      return this.rows<Rule>(
        'SELECT * FROM alert_rules WHERE ($1::uuid IS NULL OR organization_id=$1) ORDER BY created_at DESC',
        [query.organizationId || null],
      );
    if (!ids.length) return [];
    return this.rows<Rule>(
      'SELECT * FROM alert_rules WHERE equipment_id=ANY($1::uuid[]) OR (organization_id=(SELECT organization_id FROM users WHERE id=$2) AND equipment_id IS NULL) ORDER BY created_at DESC',
      [ids, actor.sub],
    );
  }

  async saveRule(actor: Actor, body: Record<string, unknown>, id?: string) {
    if (actor.role !== 'Admin') throw new ForbiddenException();
    const validTypes = [
      'MONITOR_OFFLINE',
      'LOW_FUEL',
      'STALE_FUEL',
      'MAINTENANCE_DUE',
      'RECONCILIATION_VARIANCE',
    ];
    const type = typeof body.type === 'string' ? body.type : '';
    if (!validTypes.includes(type))
      throw new BadRequestException('Invalid alert type');
    const severity =
      typeof body.severity === 'string' ? body.severity : 'WARNING';
    if (!['INFO', 'WARNING', 'CRITICAL'].includes(severity))
      throw new BadRequestException('Invalid severity');
    if (body.email === true)
      throw new BadRequestException(
        'Email alerts are not configured; use in-app notifications',
      );
    const equipmentId =
      typeof body.equipmentId === 'string' ? body.equipmentId : null;
    const organizationId =
      typeof body.organizationId === 'string' ? body.organizationId : null;
    if (equipmentId) {
      const equipment = await this.access.one(actor.sub, equipmentId);
      if (organizationId && equipment.organizationId !== organizationId)
        throw new BadRequestException(
          'Equipment belongs to another organization',
        );
      if (type === 'LOW_FUEL' || type === 'STALE_FUEL')
        if (equipment.type !== EquipmentType.GENERATOR)
          throw new BadRequestException(
            'Fuel alerts require generator equipment',
          );
    }
    if (!equipmentId && !organizationId)
      throw new BadRequestException('Select an organization or equipment');
    const threshold = ['LOW_FUEL', 'RECONCILIATION_VARIANCE'].includes(type)
      ? decimal(body.threshold, 'Alert threshold')
      : null;
    const freshness =
      body.freshnessMinutes === undefined
        ? 1440
        : Number(body.freshnessMinutes);
    const debounce =
      body.debounceMinutes === undefined ? 0 : Number(body.debounceMinutes);
    if (
      !Number.isInteger(freshness) ||
      freshness < 1 ||
      freshness > 525600 ||
      !Number.isInteger(debounce) ||
      debounce < 0 ||
      debounce > 10080
    )
      throw new BadRequestException('Invalid freshness or debounce minutes');
    const values = [
      organizationId,
      equipmentId,
      type,
      severity,
      threshold,
      freshness,
      debounce,
      body.enabled !== false,
      body.inApp !== false,
      actor.sub,
    ];
    let before: Rule | null = null,
      row: Rule;
    if (id) {
      before =
        (
          await this.rows<Rule>('SELECT * FROM alert_rules WHERE id=$1', [id])
        )[0] ?? null;
      if (!before) throw new NotFoundException('Rule not found');
      [row] = await this.rows<Rule>(
        `UPDATE alert_rules SET organization_id=$2,equipment_id=$3,type=$4,severity=$5,threshold=$6,freshness_minutes=$7,debounce_minutes=$8,enabled=$9,in_app=$10,updated_at=now() WHERE id=$1 RETURNING *`,
        [id, ...values.slice(0, 9)],
      );
    } else
      [row] = await this.rows<Rule>(
        `INSERT INTO alert_rules(organization_id,equipment_id,type,severity,threshold,freshness_minutes,debounce_minutes,enabled,in_app,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        values,
      );
    await this.db.query(
      'INSERT INTO operational_audit(actor_id,entity_type,entity_id,action,reason,before_data,after_data) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [
        actor.sub,
        'alert_rule',
        row.id,
        id ? 'UPDATE' : 'CREATE',
        requiredText(body.reason ?? 'Rule configuration', 'Reason', 1000),
        before ? JSON.stringify(before) : null,
        JSON.stringify(row),
      ],
    );
    if (before) {
      const resolved = await this.rows<{ equipment_id: string }>(
        `UPDATE alerts SET status='RESOLVED',resolved_at=now(),resolution_reason='Alert rule revised'
         WHERE rule_id=$1 AND status<>'RESOLVED' RETURNING equipment_id`,
        [row.id],
      );
      for (const target of resolved) await this.publish(target.equipment_id);
    }
    await this.evaluateRule(row);
    return row;
  }

  async acknowledge(actor: Actor, id: string, note: unknown) {
    const [old] = await this.rows<{
      id: string;
      equipment_id: string;
      status: string;
    }>('SELECT id,equipment_id,status FROM alerts WHERE id=$1', [id]);
    if (!old) throw new NotFoundException('Alert not found');
    await this.access.one(actor.sub, old.equipment_id);
    if (old.status !== 'OPEN')
      throw new BadRequestException('Only open alerts can be acknowledged');
    const [row] = await this.rows(
      `UPDATE alerts SET status='ACKNOWLEDGED',acknowledged_by=$2,acknowledged_at=now(),acknowledgement_note=$3 WHERE id=$1 RETURNING *`,
      [id, actor.sub, optionalText(note, 1000)],
    );
    await this.db.query(
      'INSERT INTO operational_audit(actor_id,entity_type,entity_id,action,reason,after_data) VALUES($1,$2,$3,$4,$5,$6)',
      [
        actor.sub,
        'alert',
        id,
        'ACKNOWLEDGE',
        optionalText(note, 1000),
        JSON.stringify(row),
      ],
    );
    await this.publish(old.equipment_id);
    return row;
  }

  async notifications(actor: Actor, query: Record<string, unknown>) {
    const ids = await this.access.ids(actor.sub);
    const { take, skip, page, pageSize } = pageParams(
      query.page,
      query.pageSize,
    );
    const items = await this.rows(
      `SELECT n.id,n.title,n.message,n.created_at,n.read_at,n.alert_id,a.equipment_id FROM notifications n LEFT JOIN alerts a ON a.id=n.alert_id WHERE n.user_id=$1 AND (a.id IS NULL OR a.equipment_id=ANY($2::uuid[])) ORDER BY n.created_at DESC LIMIT $3 OFFSET $4`,
      [actor.sub, ids, take, skip],
    );
    const [count] = await this.rows<{ unread: string; total: string }>(
      `SELECT count(*) FILTER (WHERE n.read_at IS NULL)::text unread,count(*)::text total FROM notifications n LEFT JOIN alerts a ON a.id=n.alert_id WHERE n.user_id=$1 AND (a.id IS NULL OR a.equipment_id=ANY($2::uuid[]))`,
      [actor.sub, ids],
    );
    return {
      items,
      unread: Number(count.unread),
      total: Number(count.total),
      page,
      pageSize,
    };
  }
  async read(actor: Actor, id?: string) {
    const ids = await this.access.ids(actor.sub);
    const rows = await this.rows(
      `UPDATE notifications n SET read_at=coalesce(read_at,now()) FROM alerts a WHERE n.alert_id=a.id AND n.user_id=$1 AND a.equipment_id=ANY($2::uuid[]) AND ($3::uuid IS NULL OR n.id=$3) RETURNING n.id`,
      [actor.sub, ids, id || null],
    );
    return { updated: rows.length };
  }
  async preferences(actor: Actor, body?: Record<string, unknown>) {
    if (!body)
      return (
        (
          await this.rows(
            'SELECT in_app,email FROM notification_preferences WHERE user_id=$1',
            [actor.sub],
          )
        )[0] ?? { in_app: true, email: false }
      );
    if (body.email === true)
      throw new BadRequestException('Email notifications are not configured');
    const [row] = await this.rows(
      `INSERT INTO notification_preferences(user_id,in_app,email) VALUES($1,$2,false) ON CONFLICT(user_id) DO UPDATE SET in_app=EXCLUDED.in_app,updated_at=now() RETURNING in_app,email`,
      [actor.sub, body.inApp !== false],
    );
    return row;
  }

  async evaluateAll() {
    const rules = await this.rows<Rule>(
      'SELECT * FROM alert_rules WHERE enabled=true',
    );
    for (const rule of rules) await this.evaluateRule(rule);
  }
  async evaluateEquipment(equipmentId: string) {
    const rules = await this.rows<Rule>(
      'SELECT * FROM alert_rules WHERE enabled=true AND (equipment_id=$1 OR (equipment_id IS NULL AND organization_id=(SELECT organization_id FROM equipment WHERE id=$1)))',
      [equipmentId],
    );
    for (const rule of rules) await this.evaluateRule(rule, equipmentId);
  }
  async refreshEquipment(equipmentId: string, kind: string) {
    await this.evaluateEquipment(equipmentId);
    const [equipment] = await this.rows<{ organization_id: string }>(
      'SELECT organization_id FROM equipment WHERE id=$1',
      [equipmentId],
    );
    if (!equipment) return;
    const users = await this.connectivity.recipientIds(
      equipmentId,
      equipment.organization_id,
    );
    this.realtime.emitOperationalUpdate(equipmentId, kind, users);
  }
  private async evaluateRule(rule: Rule, oneId?: string) {
    if (!rule.enabled) return;
    const targets = await this.rows<EquipmentRow>(
      `SELECT e.id,e.organization_id,e.name,e.type FROM equipment e JOIN organizations o ON o.id=e.organization_id WHERE e.is_active=true AND o.is_active=true AND ($1::uuid IS NULL OR e.organization_id=$1) AND ($2::uuid IS NULL OR e.id=$2) AND ($3::uuid IS NULL OR e.id=$3)`,
      [rule.organization_id, rule.equipment_id, oneId || null],
    );
    for (const equipment of targets) {
      const condition = await this.condition(rule, equipment);
      if (condition.state === 'UNKNOWN') continue;
      const dedup = `${rule.id}:${equipment.id}`;
      if (condition.state === 'TRUE') {
        if (
          rule.debounce_minutes > 0 &&
          condition.since &&
          Date.now() - condition.since.getTime() < rule.debounce_minutes * 60000
        )
          continue;
        const [alert] = await this.rows<{ id: string }>(
          `INSERT INTO alerts(organization_id,equipment_id,rule_id,type,severity,message,context,deduplication_key)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING RETURNING id`,
          [
            equipment.organization_id,
            equipment.id,
            rule.id,
            rule.type,
            rule.severity,
            condition.message,
            JSON.stringify(condition.context || {}),
            dedup,
          ],
        );
        if (alert) {
          if (rule.in_app)
            await this.deliver(
              alert.id,
              equipment.id,
              equipment.organization_id,
              condition.message,
              rule.type,
            );
          await this.publish(equipment.id);
        }
      } else {
        const resolved = await this.rows(
          `UPDATE alerts SET status='RESOLVED',resolved_at=now(),resolution_reason=$2 WHERE deduplication_key=$1 AND status<>'RESOLVED' RETURNING id`,
          [dedup, 'Fresh evidence confirms recovery'],
        );
        if (resolved.length) await this.publish(equipment.id);
      }
    }
  }
  private async condition(
    rule: Rule,
    equipment: EquipmentRow,
  ): Promise<{
    state: 'TRUE' | 'FALSE' | 'UNKNOWN';
    message: string;
    since?: Date;
    context?: Record<string, unknown>;
  }> {
    if (rule.type === 'MONITOR_OFFLINE') {
      const [d] = await this.rows<{
        last_seen_at: Date | null;
        offline_timeout_seconds: number;
      }>(
        `SELECT last_seen_at,offline_timeout_seconds FROM devices WHERE current_equipment_id=$1 LIMIT 1`,
        [equipment.id],
      );
      if (!d?.last_seen_at)
        return { state: 'UNKNOWN', message: 'Monitor has never connected' };
      const due = new Date(
        new Date(d.last_seen_at).getTime() + d.offline_timeout_seconds * 1000,
      );
      return {
        state: Date.now() > due.getTime() ? 'TRUE' : 'FALSE',
        message: `Monitor offline for ${equipment.name}`,
        since: due,
      };
    }
    if (rule.type === 'LOW_FUEL' || rule.type === 'STALE_FUEL') {
      if (equipment.type !== EquipmentType.GENERATOR)
        return { state: 'UNKNOWN', message: 'Fuel rule requires generator' };
      const [reading] = await this.rows<{
        observed_at: Date;
        level_litres: string;
        source: string;
      }>(
        `SELECT r.observed_at,r.level_litres,r.source FROM fuel_readings r JOIN fuel_tanks t ON t.id=r.tank_id WHERE t.generator_id=$1 AND r.voided_at IS NULL ORDER BY r.observed_at DESC LIMIT 1`,
        [equipment.id],
      );
      if (!reading)
        return {
          state: rule.type === 'STALE_FUEL' ? 'TRUE' : 'UNKNOWN',
          message: `No fuel reading for ${equipment.name}`,
        };
      const age = Date.now() - new Date(reading.observed_at).getTime();
      const freshness = (rule.freshness_minutes || 1440) * 60000;
      if (rule.type === 'STALE_FUEL')
        return {
          state: age > freshness ? 'TRUE' : 'FALSE',
          message: `Fuel reading is stale for ${equipment.name}`,
          since: new Date(new Date(reading.observed_at).getTime() + freshness),
        };
      if (age > freshness)
        return {
          state: 'UNKNOWN',
          message: 'Low fuel cannot be evaluated from a stale reading',
        };
      return {
        state:
          Number(reading.level_litres) <= Number(rule.threshold)
            ? 'TRUE'
            : 'FALSE',
        message: `${reading.source === 'MANUAL' ? 'Recent manual' : 'Sensor measured'} low fuel reading for ${equipment.name}`,
        since: new Date(reading.observed_at),
        context: {
          source: reading.source,
          observedAt: reading.observed_at,
          levelLitres: reading.level_litres,
        },
      };
    }
    if (rule.type === 'MAINTENANCE_DUE') {
      const plans = await this.rows<{
        trigger_type: string;
        interval_days: number | null;
        interval_hours: string | null;
        reference_service_at: Date | null;
      }>(
        `SELECT trigger_type,interval_days,interval_hours,reference_service_at FROM maintenance_plans WHERE equipment_id=$1 AND is_active=true`,
        [equipment.id],
      );
      const entity = await this.db
        .getRepository(Equipment)
        .findOne({ where: { id: equipment.id }, relations: ['site'] });
      let uncertain = false;
      for (const plan of plans) {
        if (!plan.reference_service_at) {
          uncertain = true;
          continue;
        }
        const reference = new Date(plan.reference_service_at);
        if (
          plan.trigger_type !== 'HOURS' &&
          plan.interval_days &&
          Date.now() >= reference.getTime() + plan.interval_days * 86400000
        )
          return {
            state: 'TRUE',
            message: `Maintenance due for ${equipment.name}`,
          };
        if (plan.trigger_type !== 'CALENDAR' && plan.interval_hours) {
          if (!entity?.monitoringDefinition) {
            uncertain = true;
            continue;
          }
          const metrics = await this.monitoring.metrics(
            entity,
            reference,
            new Date(),
            entity.site.timezone,
          );
          if (metrics.onMs / 3600000 >= Number(plan.interval_hours))
            return {
              state: 'TRUE',
              message: `Maintenance due for ${equipment.name}`,
            };
          if (metrics.unknownMs > 0) uncertain = true;
        }
      }
      return {
        state: uncertain ? 'UNKNOWN' : 'FALSE',
        message: `Maintenance is scheduled for ${equipment.name}`,
      };
    }
    if (rule.type === 'RECONCILIATION_VARIANCE') {
      const [recon] = await this.rows<{
        variance_litres: string;
        finalized_at: Date;
      }>(
        `SELECT r.variance_litres,r.finalized_at FROM fuel_reconciliations r JOIN fuel_tanks t ON t.id=r.tank_id WHERE t.generator_id=$1 AND r.status='FINALIZED' ORDER BY r.finalized_at DESC LIMIT 1`,
        [equipment.id],
      );
      if (!recon?.variance_litres)
        return { state: 'UNKNOWN', message: 'No finalized variance' };
      return {
        state:
          Math.abs(Number(recon.variance_litres)) > Number(rule.threshold)
            ? 'TRUE'
            : 'FALSE',
        message: `Reconciliation variance needs review for ${equipment.name}`,
        since: new Date(recon.finalized_at),
        context: { varianceLitres: recon.variance_litres },
      };
    }
    return { state: 'UNKNOWN', message: 'Unknown rule' };
  }
  private async deliver(
    alertId: string,
    equipmentId: string,
    organizationId: string,
    message: string,
    title: string,
  ) {
    await this.db.query(
      `INSERT INTO notifications(user_id,alert_id,title,message)
      SELECT u.id,$1,$2,$3 FROM users u LEFT JOIN notification_preferences p ON p.user_id=u.id WHERE u.is_active=true AND u.is_activated=true AND coalesce(p.in_app,true)=true
      AND (u.role='Admin' OR (u.role='Controller' AND u.organization_id=$4 AND EXISTS(SELECT 1 FROM user_equipment ue WHERE ue.user_id=u.id AND ue.equipment_id=$5))) ON CONFLICT DO NOTHING`,
      [alertId, title, message, organizationId, equipmentId],
    );
  }
  private async publish(equipmentId: string) {
    const [equipment] = await this.rows<{ organization_id: string }>(
      'SELECT organization_id FROM equipment WHERE id=$1',
      [equipmentId],
    );
    const users = await this.connectivity.recipientIds(
      equipmentId,
      equipment.organization_id,
    );
    this.realtime.emitAlertUpdate(equipmentId, users);
  }
}
