"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InitialSchema1746430000000 = void 0;
class InitialSchema1746430000000 {
    name = 'InitialSchema1746430000000';
    async up(queryRunner) {
        await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "password" character varying NOT NULL,
        "role" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
      )
    `);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "devices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "location" character varying NOT NULL,
        "api_key" character varying NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_devices_api_key" UNIQUE ("api_key"),
        CONSTRAINT "PK_devices_id" PRIMARY KEY ("id")
      )
    `);
        await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sensor_logs_status_enum') THEN
          CREATE TYPE "sensor_logs_status_enum" AS ENUM ('ON', 'OFF');
        END IF;
      END
      $$;
    `);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sensor_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "device_id" uuid NOT NULL,
        "status" "sensor_logs_status_enum" NOT NULL,
        "recorded_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sensor_logs_id" PRIMARY KEY ("id")
      )
    `);
        await queryRunner.query(`
      ALTER TABLE "sensor_logs"
      ADD CONSTRAINT "FK_sensor_logs_device_id"
      FOREIGN KEY ("device_id") REFERENCES "devices"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    }
    async down(queryRunner) {
        await queryRunner.query('ALTER TABLE "sensor_logs" DROP CONSTRAINT IF EXISTS "FK_sensor_logs_device_id"');
        await queryRunner.query('DROP TABLE IF EXISTS "sensor_logs"');
        await queryRunner.query('DROP TYPE IF EXISTS "sensor_logs_status_enum"');
        await queryRunner.query('DROP TABLE IF EXISTS "devices"');
        await queryRunner.query('DROP TABLE IF EXISTS "users"');
    }
}
exports.InitialSchema1746430000000 = InitialSchema1746430000000;
//# sourceMappingURL=1746430000000-InitialSchema.js.map