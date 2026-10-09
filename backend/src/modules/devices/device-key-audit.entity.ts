import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Device } from './device.entity';
import { User } from '../users/user.entity';

@Entity('device_key_audit')
export class DeviceKeyAudit {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'device_id', type: 'uuid' }) deviceId!: string;
  @ManyToOne(() => Device, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'device_id' })
  device!: Device;
  @Column({ name: 'actor_id', type: 'uuid' }) actorId!: string;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'actor_id' })
  actor!: User;
  @Column() action!: 'PROVISION' | 'ROTATE';
  @CreateDateColumn({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;
}
