import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Device } from './device.entity';
import { Equipment } from '../equipment/equipment.entity';

@Entity('device_bindings')
export class DeviceBinding {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'device_id', type: 'uuid' }) deviceId!: string;
  @ManyToOne(() => Device, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'device_id' })
  device!: Device;
  @Column({ name: 'equipment_id', type: 'uuid' }) equipmentId!: string;
  @ManyToOne(() => Equipment, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'equipment_id' })
  equipment!: Equipment;
  @Column({ name: 'started_at', type: 'timestamptz' }) startedAt!: Date;
  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt!: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
