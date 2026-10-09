"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const app_module_1 = require("./app.module");
const http_exception_filter_1 = require("./common/filters/http-exception.filter");
const http_logging_interceptor_1 = require("./common/interceptors/http-logging.interceptor");
async function bootstrap() {
    if (!process.env.JWT_SECRET ||
        Buffer.byteLength(process.env.JWT_SECRET, 'utf8') < 32) {
        throw new Error('JWT_SECRET must be configured with at least 32 UTF-8 bytes');
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
        if (!process.env[key])
            throw new Error(`${key} is required`);
    }
    for (const key of [
        'AUTH_LOGIN_LIMIT',
        'AUTH_OTP_REQUEST_LIMIT',
        'AUTH_VERIFY_LIMIT',
        'AUTH_RATE_WINDOW_SECONDS',
        'AUTH_OTP_MAX_ATTEMPTS',
    ]) {
        const value = process.env[key];
        if (value !== undefined &&
            (!Number.isInteger(Number(value)) || Number(value) < 1)) {
            throw new Error(`${key} must be a positive integer`);
        }
    }
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    });
    const bootstrapLogger = new common_1.Logger('Bootstrap');
    app.enableCors({
        origin: true,
        credentials: true,
        methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
    }));
    app.useGlobalInterceptors(new http_logging_interceptor_1.HttpLoggingInterceptor());
    app.useGlobalFilters(new http_exception_filter_1.HttpExceptionFilter());
    const configService = app.get(config_1.ConfigService);
    const port = configService.get('port', 3000);
    await app.listen(port);
    bootstrapLogger.log(`ActPulse backend running on http://localhost:${port}`);
}
void bootstrap();
//# sourceMappingURL=main.js.map