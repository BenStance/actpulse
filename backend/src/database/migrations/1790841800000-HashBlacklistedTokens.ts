import { createHash } from 'crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';

export class HashBlacklistedTokens1790841800000 implements MigrationInterface {
  name = 'HashBlacklistedTokens1790841800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      'SELECT id, token FROM token_blacklist',
    )) as { id: string; token: string }[];
    for (const row of rows) {
      await queryRunner.query(
        'UPDATE token_blacklist SET token = $1 WHERE id = $2',
        [createHash('sha256').update(row.token).digest('hex'), row.id],
      );
    }
  }

  public down(): Promise<void> {
    return Promise.reject(
      new Error('Hashing revoked tokens cannot be reversed'),
    );
  }
}
