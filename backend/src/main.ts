import 'dotenv/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { HttpLoggingInterceptor } from './common/interceptors/http-logging.interceptor';

async function bootstrap() {
  if (
    !process.env.JWT_SECRET ||
    Buffer.byteLength(process.env.JWT_SECRET, 'utf8') < 32
  ) {
    throw new Error(
      'JWT_SECRET must be configured with at least 32 UTF-8 bytes',
    );
  }
  for (const key of [
    'DB_HOST',
    'DB_USERNAME',
    'DB_PASSWORD',
    'DB_NAME',
    'EMAIL_HOST',
    'EMAIL_PORT',
    'EMAIL_USER',
    'EMAIL_PASSWORD',
  ]) {
    if (!process.env[key]) throw new Error(`${key} is required`);
  }
  for (const key of [
    'AUTH_LOGIN_LIMIT',
    'AUTH_OTP_REQUEST_LIMIT',
    'AUTH_VERIFY_LIMIT',
    'AUTH_RATE_WINDOW_SECONDS',
    'AUTH_OTP_MAX_ATTEMPTS',
  ]) {
    const value = process.env[key];
    if (
      value !== undefined &&
      (!Number.isInteger(Number(value)) || Number(value) < 1)
    ) {
      throw new Error(`${key} must be a positive integer`);
    }
  }
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  const bootstrapLogger = new Logger('Bootstrap');

  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(new HttpLoggingInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port', 3000);
  await app.listen(port);
  bootstrapLogger.log(`ActPulse backend running on http://localhost:${port}`);
}

void bootstrap();
