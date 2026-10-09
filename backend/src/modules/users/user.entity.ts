import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Device } from '../devices/device.entity';
import { PasswordOtp } from '../auth/password-otp.entity';
import { Organization } from '../organizations/organization.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { Equipment } from '../equipment/equipment.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ type: 'varchar', nullable: true })
  password!: string | null;

  @Column({ type: 'varchar' })
  role!: UserRole;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  @ManyToOne(() => Organization, (organization) => organization.users, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization | null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'is_activated', default: false })
  isActivated!: boolean;

  @Column({ name: 'token_version', default: 0 })
  tokenVersion!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToMany(() => Device, (device) => device.users)
  @JoinTable({
    name: 'user_devices',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'device_id', referencedColumnName: 'id' },
  })
  devices!: Device[];

  @ManyToMany(() => Equipment, (equipment) => equipment.users)
  @JoinTable({
    name: 'user_equipment',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'equipment_id', referencedColumnName: 'id' },
  })
  equipment!: Equipment[];

  @OneToMany(() => PasswordOtp, (otp) => otp.user)
  otps!: PasswordOtp[];
}
