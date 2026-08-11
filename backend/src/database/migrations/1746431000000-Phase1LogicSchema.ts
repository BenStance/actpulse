import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase1LogicSchema1746431000000 implements MigrationInterface {
  name = 'Phase1LogicSchema1746431000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name" character varying NOT NULL DEFAULT 'Unknown User'`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_activated" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "token_version" integer NOT NULL DEFAULT 0`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_devices" (
        "user_id" uuid NOT NULL,
        "device_id" uuid NOT NULL,
        CONSTRAINT "PK_user_devices" PRIMARY KEY ("user_id", "device_id"),
        CONSTRAINT "FK_user_devices_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_devices_device_id" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'password_otps_purpose_enum') THEN
          CREATE TYPE "password_otps_purpose_enum" AS ENUM ('FORGOT_PASSWORD', 'USER_INVITATION');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "password_otps" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying,
        "otp_code" character varying NOT NULL,
        "token" character varying UNIQUE,
        "purpose" "password_otps_purpose_enum" NOT NULL,
        "expires_at" TIMESTAMP NOT NULL,
        "used" boolean NOT NULL DEFAULT false,
        "user_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_password_otps_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_password_otps_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "token_blacklist" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "token" text NOT NULL UNIQUE,
        "blacklisted_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_token_blacklist_id" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "token_blacklist"');
    await queryRunner.query('DROP TABLE IF EXISTS "password_otps"');
    await queryRunner.query('DROP TYPE IF EXISTS "password_otps_purpose_enum"');
    await queryRunner.query('DROP TABLE IF EXISTS "user_devices"');
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN IF EXISTS "token_version"');
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN IF EXISTS "is_activated"');
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN IF EXISTS "is_active"');
    await queryRunner.query('ALTER TABLE "users" ALTER COLUMN "password" SET NOT NULL');
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN IF EXISTS "name"');
  }
}
