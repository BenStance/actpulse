import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('EXCEPTION');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse = isHttpException
      ? exception.getResponse()
      : { message: 'Internal server error' };

    const message =
      typeof errorResponse === 'string'
        ? errorResponse
        : ((errorResponse as { message?: string | string[] }).message ??
          'Unknown error');

    const stack = exception instanceof Error ? exception.stack : undefined;
    this.logger.error(
      `[ERR] ${request.method} ${request.originalUrl || request.url} status=${status} message=${JSON.stringify(message)}`,
      stack,
    );

    response.status(status).json({
      statusCode: status,
      message,
      path: request.originalUrl || request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
