import { BadRequestException } from '@nestjs/common';

export function validateNewPassword(password: string): void {
  const length = Buffer.byteLength(password, 'utf8');
  if (length < 8 || length > 72) {
    throw new BadRequestException('Password must contain 8 to 72 UTF-8 bytes');
  }
}
