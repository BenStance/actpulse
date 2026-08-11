import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Device } from '../devices/device.entity';
import { SensorStatus } from '../../common/enums/sensor-status.enum';

@Entity('sensor_logs')
export class SensorLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'device_id', type: 'uuid' })
  deviceId!: string;

  @ManyToOne(() => Device, (device) => device.sensorLogs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id' })
  device!: Device;

  @Column({
    type: 'enum',
    enum: SensorStatus,
  })
  status!: SensorStatus;

  @Column({ name: 'recorded_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  recordedAt!: Date;
}
