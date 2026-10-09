import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from '../organizations/organization.entity';
import { Equipment } from '../equipment/equipment.entity';

@Entity('sites')
export class Site {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId!: string;
  @ManyToOne(() => Organization, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;
  @Column() name!: string;
  @Column({ name: 'site_code', type: 'varchar', nullable: true }) siteCode!:
    | string
    | null;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @Column({ type: 'text', nullable: true }) address!: string | null;
  @Column({ name: 'city_region', type: 'varchar', nullable: true })
  cityRegion!: string | null;
  @Column({ type: 'numeric', precision: 9, scale: 6, nullable: true })
  latitude!: number | null;
  @Column({ type: 'numeric', precision: 9, scale: 6, nullable: true })
  longitude!: number | null;
  @Column({ default: 'Africa/Dar_es_Salaam' }) timezone!: string;
  @Column({ name: 'contact_name', type: 'varchar', nullable: true })
  contactName!: string | null;
  @Column({ name: 'contact_phone', type: 'varchar', nullable: true })
  contactPhone!: string | null;
  @Column({ name: 'is_active', default: true }) isActive!: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
  @OneToMany(() => Equipment, (equipment) => equipment.site)
  equipment!: Equipment[];
}
