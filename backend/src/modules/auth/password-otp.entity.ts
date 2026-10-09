import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OtpPurpose } from '../../common/enums/otp-purpose.enum';
import { User } from '../users/user.entity';

@Entity('password_otps')
export class PasswordOtp {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', nullable: true })
  email!: string | null;

  @Column({ name: 'otp_code' })
  otpCode!: string;

  @Column({ type: 'varchar', nullable: true, unique: true })
  token!: string | null;

  @Column({ type: 'enum', enum: OtpPurpose })
  purpose!: OtpPurpose;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt!: Date;

  @Column({ default: false })
  used!: boolean;

  @Column({ name: 'failed_attempts', default: 0 })
  failedAttempts!: number;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @ManyToOne(() => User, (user) => user.otps, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'user_id' })
  user!: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
