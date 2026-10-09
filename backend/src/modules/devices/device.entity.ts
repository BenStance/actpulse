import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { SensorLog } from '../sensors/sensor-log.entity';
import { Organization } from '../organizations/organization.entity';
import { Equipment } from '../equipment/equipment.entity';

export enum DeviceLifecycle {
  UNPROVISIONED = 'UNPROVISIONED',
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
  RETIRED = 'RETIRED',
}
export enum ConnectivityState {
  NEVER_CONNECTED = 'NEVER_CONNECTED',
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
}

@Entity('devices')
export class Device {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column() name!: string;
  @Column() location!: string; // Original legacy location text is retained.
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId!: string;
  @ManyToOne(() => Organization, (organization) => organization.devices, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;
  @Column({ name: 'current_equipment_id', type: 'uuid', nullable: true })
  currentEquipmentId!: string | null;
  @ManyToOne(() => Equipment, (equipment) => equipment.monitors, {
    onDelete: 'RESTRICT',
    nullable: true,
  })
  @JoinColumn({ name: 'current_equipment_id' })
  equipment!: Equipment | null;
  @Column({ name: 'device_identifier', unique: true })
  deviceIdentifier!: string;
  @Column({ name: 'hardware_model', type: 'varchar', nullable: true })
  hardwareModel!: string | null;
  @Column({ name: 'firmware_version', type: 'varchar', nullable: true })
  firmwareVersion!: string | null;
  @Column({
    name: 'lifecycle_state',
    type: 'varchar',
    default: DeviceLifecycle.ACTIVE,
  })
  lifecycleState!: DeviceLifecycle;
  @Column({ name: 'credential_id', type: 'varchar', nullable: true })
  credentialId!: string | null;
  @Column({ name: 'credential_hash', type: 'char', length: 64, nullable: true })
  credentialHash!: string | null;
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean; // Legacy compatibility; lifecycle is authoritative.
  @Column({ name: 'first_seen_at', type: 'timestamptz', nullable: true })
  firstSeenAt!: Date | null;
  @Column({ name: 'last_seen_at', type: 'timestamptz', nullable: true })
  lastSeenAt!: Date | null;
  @Column({ name: 'last_status_at', type: 'timestamptz', nullable: true })
  lastStatusAt!: Date | null;
  @Column({ name: 'connected_since_at', type: 'timestamptz', nullable: true })
  connectedSinceAt!: Date | null;
  @Column({
    name: 'connectivity_state',
    type: 'varchar',
    default: ConnectivityState.NEVER_CONNECTED,
  })
  connectivityState!: ConnectivityState;
  @Column({ name: 'heartbeat_interval_seconds', default: 30 })
  heartbeatIntervalSeconds!: number;
  @Column({ name: 'offline_timeout_seconds', default: 120 })
  offlineTimeoutSeconds!: number;
  @Column({ name: 'provisioned_at', type: 'timestamptz', nullable: true })
  provisionedAt!: Date | null;
  @Column({ name: 'rotated_at', type: 'timestamptz', nullable: true })
  rotatedAt!: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
  @OneToMany(() => SensorLog, (sensorLog) => sensorLog.device)
  sensorLogs!: SensorLog[];
  @ManyToMany(() => User, (user) => user.devices) users!: User[];
}
