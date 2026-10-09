import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

const allowedFields = new Set([
  'status',
  'isActive',
  'role',
  'planCode',
  'billingCycle',
  'siteLimit',
  'equipmentLimit',
  'controllerLimit',
  'assignmentCount',
  'action',
  'kind',
  'currency',
  'amount',
  'source',
  'reasonCode',
]);
function safeChanges(value: Record<string, unknown> | null) {
  if (!value) return null;
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, field] of Object.entries(value))
    if (
      allowedFields.has(key) &&
      (field === null || ['string', 'number', 'boolean'].includes(typeof field))
    )
      result[key] = field as string | number | boolean | null;
  return result;
}
@Injectable()
export class AuditTrailService {
  constructor(private readonly db: DataSource) {}
  async record(
    input: {
      actorId?: string | null;
      actorRole?: string | null;
      organizationId?: string | null;
      action: string;
      entityType: string;
      entityId?: string | null;
      before?: Record<string, unknown> | null;
      after?: Record<string, unknown> | null;
      reason?: string | null;
    },
    manager: EntityManager = this.db.manager,
  ) {
    await manager.query(
      'INSERT INTO audit_logs(actor_user_id,actor_role,organization_id,action,entity_type,entity_id,before_changes,after_changes,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [
        input.actorId || null,
        input.actorRole || null,
        input.organizationId || null,
        input.action,
        input.entityType,
        input.entityId || null,
        input.before ? JSON.stringify(safeChanges(input.before)) : null,
        input.after ? JSON.stringify(safeChanges(input.after)) : null,
        input.reason || null,
      ],
    );
  }
}
