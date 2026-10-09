import { createHmac } from 'crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';

export class OtpAttempts1790841700000 implements MigrationInterface {
  name = 'OtpAttempts1790841700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const secret = process.env.JWT_SECRET;
    if (!secret)
      throw new Error('JWT_SECRET is required to migrate OTP hashes');
    await queryRunner.query(
      'ALTER TABLE password_otps ADD COLUMN failed_attempts integer NOT NULL DEFAULT 0',
    );
    const rows = (await queryRunner.query(
      'SELECT id, email, purpose, otp_code, token FROM password_otps',
    )) as {
      id: string;
      email: string | null;
      purpose: string;
      otp_code: string;
      token: string | null;
    }[];
    for (const row of rows) {
      const codeHash = createHmac('sha256', secret)
        .update(
          `otp:${row.purpose}:${row.email?.toLowerCase() ?? ''}:${row.otp_code}`,
        )
        .digest('hex');
      const tokenHash = row.token
        ? createHmac('sha256', secret)
            .update(`invitation:${row.token}`)
            .digest('hex')
        : null;
      await queryRunner.query(
        'UPDATE password_otps SET otp_code = $1, token = $2 WHERE id = $3',
        [codeHash, tokenHash, row.id],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE password_otps DROP COLUMN failed_attempts',
    );
  }
}
