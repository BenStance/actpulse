import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('token_blacklist')
export class TokenBlacklist {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true, type: 'text' })
  token!: string;

  @CreateDateColumn({ name: 'blacklisted_at' })
  blacklistedAt!: Date;
}
