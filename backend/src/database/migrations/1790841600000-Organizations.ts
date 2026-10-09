import { MigrationInterface, QueryRunner } from 'typeorm';

export class Organizations1790841600000 implements MigrationInterface {
  name = 'Organizations1790841600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM users WHERE role NOT IN ('Admin', 'Controller')) THEN
        RAISE EXCEPTION 'Legacy User or unknown role records require explicit mapping before migration';
      END IF;
      IF EXISTS (SELECT 1 FROM users GROUP BY lower(trim(email)) HAVING count(*) > 1) THEN
        RAISE EXCEPTION 'Duplicate normalized user emails require explicit cleanup before migration';
      END IF;
    END $$`);
    await queryRunner.query(`CREATE TABLE organizations (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      name varchar NOT NULL,
      contact_email varchar,
      contact_phone varchar,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(
      'ALTER TABLE users ADD COLUMN organization_id uuid',
    );
    await queryRunner.query(
      'ALTER TABLE devices ADD COLUMN organization_id uuid',
    );
    await queryRunner.query(`INSERT INTO organizations (name)
      SELECT 'Legacy Customer' WHERE EXISTS (SELECT 1 FROM devices) OR EXISTS (SELECT 1 FROM users WHERE role = 'Controller')`);
    await queryRunner.query(
      `UPDATE users SET organization_id = (SELECT id FROM organizations WHERE name = 'Legacy Customer') WHERE role = 'Controller'`,
    );
    await queryRunner.query(
      `UPDATE devices SET organization_id = (SELECT id FROM organizations WHERE name = 'Legacy Customer')`,
    );
    await queryRunner.query(`UPDATE users SET email = lower(trim(email))`);
    await queryRunner.query(
      `UPDATE password_otps SET email = lower(trim(email)) WHERE email IS NOT NULL`,
    );
    await queryRunner.query(
      'ALTER TABLE devices ALTER COLUMN organization_id SET NOT NULL',
    );
    await queryRunner.query(`ALTER TABLE users ADD CONSTRAINT users_role_organization_check CHECK (
      (role = 'Admin' AND organization_id IS NULL) OR (role = 'Controller' AND organization_id IS NOT NULL)
    )`);
    await queryRunner.query(
      'ALTER TABLE users ADD CONSTRAINT FK_users_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT',
    );
    await queryRunner.query(
      'ALTER TABLE devices ADD CONSTRAINT FK_devices_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT',
    );
    await queryRunner.query(
      'CREATE INDEX IDX_users_organization ON users (organization_id)',
    );
    await queryRunner.query(
      'CREATE INDEX IDX_devices_organization ON devices (organization_id)',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX UQ_users_email_normalized ON users (lower(trim(email)))',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX UQ_users_email_normalized');
    await queryRunner.query('DROP INDEX IDX_devices_organization');
    await queryRunner.query('DROP INDEX IDX_users_organization');
    await queryRunner.query(
      'ALTER TABLE devices DROP CONSTRAINT FK_devices_organization',
    );
    await queryRunner.query(
      'ALTER TABLE users DROP CONSTRAINT FK_users_organization',
    );
    await queryRunner.query(
      'ALTER TABLE users DROP CONSTRAINT users_role_organization_check',
    );
    await queryRunner.query('ALTER TABLE devices DROP COLUMN organization_id');
    await queryRunner.query('ALTER TABLE users DROP COLUMN organization_id');
    await queryRunner.query('DROP TABLE organizations');
  }
}
