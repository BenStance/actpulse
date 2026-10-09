import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Device } from '../devices/device.entity';
import { User } from '../users/user.entity';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column() name!: string;
  @Column({ name: 'contact_email', type: 'varchar', nullable: true })
  contactEmail!: string | null;
  @Column({ name: 'contact_phone', type: 'varchar', nullable: true })
  contactPhone!: string | null;
  @Column({ name: 'is_active', default: true }) isActive!: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
  @OneToMany(() => User, (user) => user.organization) users!: User[];
  @OneToMany(() => Device, (device) => device.organization) devices!: Device[];
}
