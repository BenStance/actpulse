import { createHmac, randomBytes, randomInt } from 'crypto';
import { OtpPurpose } from '../../common/enums/otp-purpose.enum';

function secret(): string {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error('JWT_SECRET is required');
  return value;
}

export function otpHash(
  purpose: OtpPurpose,
  email: string,
  otp: string,
): string {
  return createHmac('sha256', secret())
    .update(`otp:${purpose}:${email.toLowerCase()}:${otp}`)
    .digest('hex');
}

export function invitationHash(token: string): string {
  return createHmac('sha256', secret())
    .update(`invitation:${token}`)
    .digest('hex');
}

export function newOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function newInvitationToken(): string {
  return randomBytes(32).toString('hex');
}
