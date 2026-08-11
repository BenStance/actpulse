import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const now = Date.now();
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const method = req.method;
    const url = req.originalUrl || req.url;
    const ip = req.ip;
    const userAgent = req.get('user-agent') ?? 'unknown-agent';
    const body = this.maskSensitive(req.body as Record<string, unknown> | undefined);

    this.logger.log(`[REQ] ${method} ${url} ip=${ip} ua="${userAgent}" body=${JSON.stringify(body)}`);

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - now;
          this.logger.log(`[RES] ${method} ${url} status=${res.statusCode} duration=${ms}ms`);
        },
      }),
    );
  }

  private maskSensitive(body?: Record<string, unknown>) {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const clone = { ...body };
    const sensitiveKeys = ['password', 'oldPassword', 'newPassword', 'otp', 'token'];

    for (const key of sensitiveKeys) {
      if (key in clone) {
        clone[key] = '***';
      }
    }

    return clone;
  }
}
