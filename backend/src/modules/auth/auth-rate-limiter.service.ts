import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

@Injectable()
export class AuthRateLimiterService {
  private readonly counters = new Map<
    string,
    { count: number; until: number }
  >();

  check(kind: 'login' | 'request' | 'verify', key: string): void {
    const limit = Number(
      process.env[
        `AUTH_${kind === 'request' ? 'OTP_REQUEST' : kind === 'verify' ? 'VERIFY' : 'LOGIN'}_LIMIT`
      ] ?? (kind === 'login' ? 10 : kind === 'request' ? 3 : 5),
    );
    const windowMs = Number(process.env.AUTH_RATE_WINDOW_SECONDS ?? 900) * 1000;
    const now = Date.now();
    const id = `${kind}:${key.toLowerCase()}`;
    const previous = this.counters.get(id);
    const entry =
      previous && previous.until > now
        ? previous
        : { count: 0, until: now + windowMs };
    entry.count += 1;
    this.counters.set(id, entry);
    if (entry.count > limit)
      throw new HttpException(
        'Too many attempts. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
  }
}
