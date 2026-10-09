import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Device } from '../devices/device.entity';
import { Equipment } from '../equipment/equipment.entity';

@Entity('monitor_connectivity_events')
export class ConnectivityEvent {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'device_id', type: 'uuid' }) deviceId!: string;
  @ManyToOne(() => Device, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'device_id' })
  device!: Device;
  @Column({ name: 'equipment_id', type: 'uuid', nullable: true }) equipmentId!:
    | string
    | null;
  @ManyToOne(() => Equipment, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'equipment_id' })
  equipment!: Equipment | null;
  @Column() type!: 'FIRST_CONTACT' | 'ONLINE' | 'OFFLINE';
  @CreateDateColumn({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;
}
