import { MigrationInterface, QueryRunner } from 'typeorm';

export class SubscriptionGrace1790842200000 implements MigrationInterface {
  name = 'SubscriptionGrace1790842200000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE organization_subscriptions
      ADD COLUMN grace_ends_at timestamptz,
      ADD CONSTRAINT subscription_grace_after_paid_end CHECK (
        grace_ends_at IS NULL OR
        (paid_end_at IS NOT NULL AND grace_ends_at > paid_end_at)
      )`);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE organization_subscriptions
      DROP CONSTRAINT subscription_grace_after_paid_end,
      DROP COLUMN grace_ends_at`);
  }
}
