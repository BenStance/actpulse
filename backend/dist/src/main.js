"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const app_module_1 = require("./app.module");
const auth_service_1 = require("./modules/auth/auth.service");
const http_exception_filter_1 = require("./common/filters/http-exception.filter");
const http_logging_interceptor_1 = require("./common/interceptors/http-logging.interceptor");
async function bootstrap() {
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
    const authService = app.get(auth_service_1.AuthService);
    await authService.seedAdmin();
    const configService = app.get(config_1.ConfigService);
    const port = configService.get('port', 3000);
    await app.listen(port);
    bootstrapLogger.log(`ActPulse backend running on http://localhost:${port}`);
}
void bootstrap();
//# sourceMappingURL=main.js.map