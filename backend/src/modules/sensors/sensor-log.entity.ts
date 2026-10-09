import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Device } from '../devices/device.entity';
import { Equipment } from '../equipment/equipment.entity';
import { SensorStatus } from '../../common/enums/sensor-status.enum';

@Entity('sensor_logs')
export class SensorLog {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'device_id', type: 'uuid' }) deviceId!: string;
  @ManyToOne(() => Device, (device) => device.sensorLogs, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'device_id' })
  device!: Device;
  @Column({ name: 'equipment_id', type: 'uuid' }) equipmentId!: string;
  @ManyToOne(() => Equipment, (equipment) => equipment.observations, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'equipment_id' })
  equipment!: Equipment;
  @Column({ type: 'enum', enum: SensorStatus }) status!: SensorStatus;
  @Column({
    name: 'recorded_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  recordedAt!: Date;
  @Column({
    name: 'received_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  receivedAt!: Date;
  @Column({ name: 'timestamp_basis' }) timestampBasis!: 'RECEIVED' | 'DEVICE';
  @Column() source!: 'DEVICE' | 'SIMULATOR';
  @Column({ name: 'event_id', type: 'varchar', nullable: true }) eventId!:
    | string
    | null;
  @Column() kind!: 'TRANSITION' | 'CONFIRMATION';
}
