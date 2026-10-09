import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('fuel_tanks')
export class FuelTank {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId!: string;
  @Column({ name: 'generator_id', type: 'uuid' }) generatorId!: string;
  @Column() name!: string;
  @Column({ name: 'capacity_litres', type: 'numeric', precision: 14, scale: 3 })
  capacityLitres!: string;
  @Column({ name: 'is_active', type: 'boolean' }) isActive!: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity('fuel_readings')
export class FuelReading {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'tank_id', type: 'uuid' }) tankId!: string;
  @Column({ name: 'observed_at', type: 'timestamptz' }) observedAt!: Date;
  @Column({ name: 'received_at', type: 'timestamptz' }) receivedAt!: Date;
  @Column({ name: 'level_litres', type: 'numeric', precision: 14, scale: 3 })
  levelLitres!: string;
  @Column({ type: 'varchar' }) source!: 'MANUAL' | 'SENSOR';
  @Column({ type: 'varchar', nullable: true }) method!: string | null;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @Column({ name: 'recorded_by', type: 'uuid', nullable: true }) recordedBy!:
    | string
    | null;
  @Column({ name: 'source_event_id', type: 'varchar', nullable: true })
  sourceEventId!: string | null;
  @Column({ name: 'voided_at', type: 'timestamptz', nullable: true })
  voidedAt!: Date | null;
  @Column({ name: 'voided_by', type: 'uuid', nullable: true }) voidedBy!:
    | string
    | null;
  @Column({ name: 'void_reason', type: 'text', nullable: true }) voidReason!:
    | string
    | null;
  @Column({ name: 'corrected_from_id', type: 'uuid', nullable: true })
  correctedFromId!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity('fuel_refills')
export class FuelRefill {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'tank_id', type: 'uuid' }) tankId!: string;
  @Column({ name: 'occurred_at', type: 'timestamptz' }) occurredAt!: Date;
  @Column({ name: 'quantity_litres', type: 'numeric', precision: 14, scale: 3 })
  quantityLitres!: string;
  @Column({ name: 'before_reading_id', type: 'uuid', nullable: true })
  beforeReadingId!: string | null;
  @Column({ name: 'after_reading_id', type: 'uuid', nullable: true })
  afterReadingId!: string | null;
  @Column({ type: 'varchar', nullable: true }) supplier!: string | null;
  @Column({ type: 'varchar', nullable: true }) reference!: string | null;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @Column({ type: 'char', length: 3, nullable: true }) currency!: string | null;
  @Column({
    name: 'unit_price',
    type: 'numeric',
    precision: 18,
    scale: 4,
    nullable: true,
  })
  unitPrice!: string | null;
  @Column({
    name: 'fuel_amount',
    type: 'numeric',
    precision: 18,
    scale: 4,
    nullable: true,
  })
  fuelAmount!: string | null;
  @Column({
    name: 'additional_cost',
    type: 'numeric',
    precision: 18,
    scale: 4,
    nullable: true,
  })
  additionalCost!: string | null;
  @Column({
    name: 'total_amount',
    type: 'numeric',
    precision: 18,
    scale: 4,
    nullable: true,
  })
  totalAmount!: string | null;
  @Column({ name: 'recorded_by', type: 'uuid' }) recordedBy!: string;
  @Column({ name: 'voided_at', type: 'timestamptz', nullable: true })
  voidedAt!: Date | null;
  @Column({ name: 'voided_by', type: 'uuid', nullable: true }) voidedBy!:
    | string
    | null;
  @Column({ name: 'void_reason', type: 'text', nullable: true }) voidReason!:
    | string
    | null;
  @Column({ name: 'corrected_from_id', type: 'uuid', nullable: true })
  correctedFromId!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity('fuel_adjustments')
export class FuelAdjustment {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'tank_id', type: 'uuid' }) tankId!: string;
  @Column({ name: 'occurred_at', type: 'timestamptz' }) occurredAt!: Date;
  @Column({ type: 'varchar' }) direction!: 'ADDITION' | 'REMOVAL';
  @Column({ name: 'quantity_litres', type: 'numeric', precision: 14, scale: 3 })
  quantityLitres!: string;
  @Column() reason!: string;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @Column({ type: 'varchar', nullable: true }) reference!: string | null;
  @Column({ name: 'recorded_by', type: 'uuid' }) recordedBy!: string;
  @Column({ name: 'voided_at', type: 'timestamptz', nullable: true })
  voidedAt!: Date | null;
  @Column({ name: 'voided_by', type: 'uuid', nullable: true }) voidedBy!:
    | string
    | null;
  @Column({ name: 'void_reason', type: 'text', nullable: true }) voidReason!:
    | string
    | null;
  @Column({ name: 'corrected_from_id', type: 'uuid', nullable: true })
  correctedFromId!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity('fuel_estimates')
export class FuelEstimate {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'generator_id', type: 'uuid' }) generatorId!: string;
  @Column({
    name: 'estimated_litres_per_hour',
    type: 'numeric',
    precision: 14,
    scale: 4,
  })
  estimatedLitresPerHour!: string;
  @Column({ name: 'effective_from', type: 'timestamptz' }) effectiveFrom!: Date;
  @Column({ name: 'effective_to', type: 'timestamptz', nullable: true })
  effectiveTo!: Date | null;
  @Column({ type: 'text' }) basis!: string;
  @Column({ name: 'created_by', type: 'uuid' }) createdBy!: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity('fuel_reconciliations')
export class FuelReconciliation {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'tank_id', type: 'uuid' }) tankId!: string;
  @Column({ name: 'opening_reading_id', type: 'uuid' })
  openingReadingId!: string;
  @Column({ name: 'closing_reading_id', type: 'uuid' })
  closingReadingId!: string;
  @Column({ name: 'period_from', type: 'timestamptz' }) periodFrom!: Date;
  @Column({ name: 'period_to', type: 'timestamptz' }) periodTo!: Date;
  @Column({ name: 'opening_litres', type: 'numeric', precision: 14, scale: 3 })
  openingLitres!: string;
  @Column({ name: 'refill_litres', type: 'numeric', precision: 14, scale: 3 })
  refillLitres!: string;
  @Column({ name: 'addition_litres', type: 'numeric', precision: 14, scale: 3 })
  additionLitres!: string;
  @Column({ name: 'removal_litres', type: 'numeric', precision: 14, scale: 3 })
  removalLitres!: string;
  @Column({ name: 'closing_litres', type: 'numeric', precision: 14, scale: 3 })
  closingLitres!: string;
  @Column({
    name: 'apparent_usage_litres',
    type: 'numeric',
    precision: 14,
    scale: 3,
  })
  apparentUsageLitres!: string;
  @Column({
    name: 'estimated_litres',
    type: 'numeric',
    precision: 14,
    scale: 3,
    nullable: true,
  })
  estimatedLitres!: string | null;
  @Column({
    name: 'variance_litres',
    type: 'numeric',
    precision: 14,
    scale: 3,
    nullable: true,
  })
  varianceLitres!: string | null;
  @Column({ name: 'review_flag', type: 'varchar', nullable: true })
  reviewFlag!: string | null;
  @Column({ name: 'included_refill_ids', type: 'uuid', array: true })
  includedRefillIds!: string[];
  @Column({ name: 'included_adjustment_ids', type: 'uuid', array: true })
  includedAdjustmentIds!: string[];
  @Column({ type: 'varchar' }) status!: 'DRAFT' | 'FINALIZED';
  @Column({ name: 'calculation_version', type: 'integer' })
  calculationVersion!: number;
  @Column({ name: 'created_by', type: 'uuid' }) createdBy!: string;
  @Column({ name: 'finalized_by', type: 'uuid', nullable: true }) finalizedBy!:
    | string
    | null;
  @Column({ name: 'finalized_at', type: 'timestamptz', nullable: true })
  finalizedAt!: Date | null;
  @Column({ name: 'finalization_note', type: 'text', nullable: true })
  finalizationNote!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity('maintenance_plans')
export class MaintenancePlan {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'equipment_id', type: 'uuid' }) equipmentId!: string;
  @Column() title!: string;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @Column({ type: 'text', nullable: true }) checklist!: string | null;
  @Column({ name: 'trigger_type', type: 'varchar' }) triggerType!:
    | 'CALENDAR'
    | 'HOURS'
    | 'BOTH';
  @Column({ name: 'interval_days', type: 'integer', nullable: true })
  intervalDays!: number | null;
  @Column({
    name: 'interval_hours',
    type: 'numeric',
    precision: 14,
    scale: 3,
    nullable: true,
  })
  intervalHours!: string | null;
  @Column({ name: 'reference_service_at', type: 'timestamptz', nullable: true })
  referenceServiceAt!: Date | null;
  @Column({
    name: 'reference_hours',
    type: 'numeric',
    precision: 14,
    scale: 3,
    nullable: true,
  })
  referenceHours!: string | null;
  @Column({ name: 'reminder_days', type: 'integer' }) reminderDays!: number;
  @Column({ name: 'reminder_hours', type: 'numeric', precision: 14, scale: 3 })
  reminderHours!: string;
  @Column({ name: 'is_active', type: 'boolean' }) isActive!: boolean;
  @Column({ name: 'created_by', type: 'uuid' }) createdBy!: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity('service_records')
export class ServiceRecord {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'equipment_id', type: 'uuid' }) equipmentId!: string;
  @Column({ name: 'maintenance_plan_id', type: 'uuid', nullable: true })
  maintenancePlanId!: string | null;
  @Column({ name: 'performed_at', type: 'timestamptz' }) performedAt!: Date;
  @Column({ type: 'text' }) description!: string;
  @Column({ name: 'completed_checklist', type: 'text', nullable: true })
  completedChecklist!: string | null;
  @Column({ type: 'varchar', nullable: true }) technician!: string | null;
  @Column({
    name: 'meter_hours',
    type: 'numeric',
    precision: 14,
    scale: 3,
    nullable: true,
  })
  meterHours!: string | null;
  @Column({
    name: 'observed_hours',
    type: 'numeric',
    precision: 14,
    scale: 3,
    nullable: true,
  })
  observedHours!: string | null;
  @Column({ name: 'hour_basis', type: 'varchar', nullable: true }) hourBasis!:
    | string
    | null;
  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true }) cost!:
    | string
    | null;
  @Column({ type: 'char', length: 3, nullable: true }) currency!: string | null;
  @Column({ type: 'varchar', nullable: true }) reference!: string | null;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @Column({ name: 'resets_plan_baseline', type: 'boolean' })
  resetsPlanBaseline!: boolean;
  @Column({ name: 'recorded_by', type: 'uuid' }) recordedBy!: string;
  @Column({ name: 'voided_at', type: 'timestamptz', nullable: true })
  voidedAt!: Date | null;
  @Column({ name: 'voided_by', type: 'uuid', nullable: true }) voidedBy!:
    | string
    | null;
  @Column({ name: 'void_reason', type: 'text', nullable: true }) voidReason!:
    | string
    | null;
  @Column({ name: 'corrected_from_id', type: 'uuid', nullable: true })
  correctedFromId!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity('alert_rules')
export class AlertRule {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;
  @Column({ name: 'equipment_id', type: 'uuid', nullable: true }) equipmentId!:
    | string
    | null;
  @Column() type!: string;
  @Column() severity!: string;
  @Column({ type: 'numeric', precision: 14, scale: 3, nullable: true })
  threshold!: string | null;
  @Column({ name: 'freshness_minutes', type: 'integer', nullable: true })
  freshnessMinutes!: number | null;
  @Column({ name: 'debounce_minutes', type: 'integer' })
  debounceMinutes!: number;
  @Column({ type: 'boolean' }) enabled!: boolean;
  @Column({ name: 'in_app', type: 'boolean' }) inApp!: boolean;
  @Column({ type: 'boolean' }) email!: boolean;
  @Column({ name: 'created_by', type: 'uuid' }) createdBy!: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity('alerts')
export class Alert {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId!: string;
  @Column({ name: 'equipment_id', type: 'uuid' }) equipmentId!: string;
  @Column({ name: 'rule_id', type: 'uuid' }) ruleId!: string;
  @Column() type!: string;
  @Column() severity!: string;
  @Column({ type: 'text' }) message!: string;
  @Column({ type: 'jsonb' }) context!: Record<string, unknown>;
  @Column({ name: 'triggered_at', type: 'timestamptz' }) triggeredAt!: Date;
  @Column({ type: 'varchar' }) status!: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  @Column({ name: 'acknowledged_by', type: 'uuid', nullable: true })
  acknowledgedBy!: string | null;
  @Column({ name: 'acknowledged_at', type: 'timestamptz', nullable: true })
  acknowledgedAt!: Date | null;
  @Column({ name: 'acknowledgement_note', type: 'text', nullable: true })
  acknowledgementNote!: string | null;
  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;
  @Column({ name: 'resolution_reason', type: 'text', nullable: true })
  resolutionReason!: string | null;
  @Column({ name: 'deduplication_key' }) deduplicationKey!: string;
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'user_id', type: 'uuid' }) userId!: string;
  @Column({ name: 'alert_id', type: 'uuid', nullable: true }) alertId!:
    | string
    | null;
  @Column() title!: string;
  @Column({ type: 'text' }) message!: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt!: Date | null;
  @Column({ name: 'delivery_status' }) deliveryStatus!: string;
}

@Entity('notification_preferences')
export class NotificationPreference {
  @Column({ name: 'user_id', type: 'uuid', primary: true }) userId!: string;
  @Column({ name: 'in_app', type: 'boolean' }) inApp!: boolean;
  @Column({ type: 'boolean' }) email!: boolean;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity('operational_audit')
export class OperationalAudit {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'actor_id', type: 'uuid' }) actorId!: string;
  @Column({ name: 'entity_type' }) entityType!: string;
  @Column({ name: 'entity_id', type: 'uuid' }) entityId!: string;
  @Column() action!: string;
  @Column({ type: 'text', nullable: true }) reason!: string | null;
  @Column({ name: 'before_data', type: 'jsonb', nullable: true })
  beforeData!: Record<string, unknown> | null;
  @Column({ name: 'after_data', type: 'jsonb', nullable: true })
  afterData!: Record<string, unknown> | null;
  @CreateDateColumn({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;
}
