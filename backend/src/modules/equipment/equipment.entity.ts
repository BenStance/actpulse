import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from '../organizations/organization.entity';
import { Site } from '../sites/site.entity';
import { Device } from '../devices/device.entity';
import { User } from '../users/user.entity';
import { SensorLog } from '../sensors/sensor-log.entity';

export enum EquipmentType {
  GENERATOR = 'GENERATOR',
  UPS = 'UPS',
  UNSPECIFIED = 'UNSPECIFIED',
}
export enum MonitoringDefinition {
  OUTPUT_POWER_PRESENT = 'OUTPUT_POWER_PRESENT',
  ENGINE_RUNNING = 'ENGINE_RUNNING',
}

@Entity('equipment')
export class Equipment {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId!: string;
  @ManyToOne(() => Organization, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;
  @Column({ name: 'site_id', type: 'uuid' }) siteId!: string;
  @ManyToOne(() => Site, (site) => site.equipment, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'site_id' })
  site!: Site;
  @Column({ type: 'varchar' }) type!: EquipmentType;
  @Column({ name: 'monitoring_definition', type: 'varchar', nullable: true })
  monitoringDefinition!: MonitoringDefinition | null;
  @Column() name!: string;
  @Column({ name: 'asset_tag', type: 'varchar', nullable: true }) assetTag!:
    | string
    | null;
  @Column({ type: 'varchar', nullable: true }) manufacturer!: string | null;
  @Column({ type: 'varchar', nullable: true }) model!: string | null;
  @Column({ name: 'serial_number', type: 'varchar', nullable: true })
  serialNumber!: string | null;
  @Column({ name: 'installation_date', type: 'date', nullable: true })
  installationDate!: string | null;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @Column({
    name: 'rated_capacity_kva',
    type: 'numeric',
    precision: 12,
    scale: 3,
    nullable: true,
  })
  ratedCapacityKva!: number | null;
  @Column({ name: 'fuel_type', type: 'varchar', nullable: true }) fuelType!:
    | string
    | null;
  @Column({
    name: 'tank_capacity_litres',
    type: 'numeric',
    precision: 12,
    scale: 3,
    nullable: true,
  })
  tankCapacityLitres!: number | null;
  @Column({
    name: 'opening_running_hours',
    type: 'numeric',
    precision: 14,
    scale: 3,
    nullable: true,
  })
  openingRunningHours!: number | null;
  @Column({ name: 'opening_hours_at', type: 'timestamptz', nullable: true })
  openingHoursAt!: Date | null;
  @Column({
    name: 'service_interval_hours',
    type: 'numeric',
    precision: 12,
    scale: 3,
    nullable: true,
  })
  serviceIntervalHours!: number | null;
  @Column({
    name: 'rated_capacity_kw',
    type: 'numeric',
    precision: 12,
    scale: 3,
    nullable: true,
  })
  ratedCapacityKw!: number | null;
  @Column({
    name: 'battery_capacity_ah',
    type: 'numeric',
    precision: 12,
    scale: 3,
    nullable: true,
  })
  batteryCapacityAh!: number | null;
  @Column({
    name: 'nominal_battery_voltage',
    type: 'numeric',
    precision: 12,
    scale: 3,
    nullable: true,
  })
  nominalBatteryVoltage!: number | null;
  @Column({ name: 'battery_notes', type: 'text', nullable: true })
  batteryNotes!: string | null;
  @Column({ name: 'is_active', default: true }) isActive!: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
  @OneToMany(() => Device, (device) => device.equipment) monitors!: Device[];
  @OneToMany(() => SensorLog, (log) => log.equipment)
  observations!: SensorLog[];
  @ManyToMany(() => User, (user) => user.equipment) users!: User[];
}
