"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpLoggingInterceptor = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
let HttpLoggingInterceptor = class HttpLoggingInterceptor {
    logger = new common_1.Logger('HTTP');
    intercept(context, next) {
        const now = Date.now();
        const http = context.switchToHttp();
        const req = http.getRequest();
        const res = http.getResponse();
        const method = req.method;
        const url = req.path;
        const ip = req.ip;
        this.logger.log(`[REQ] ${method} ${url} ip=${ip}`);
        return next.handle().pipe((0, rxjs_1.tap)({
            next: () => {
                const ms = Date.now() - now;
                this.logger.log(`[RES] ${method} ${url} status=${res.statusCode} duration=${ms}ms`);
            },
        }));
    }
};
exports.HttpLoggingInterceptor = HttpLoggingInterceptor;
exports.HttpLoggingInterceptor = HttpLoggingInterceptor = __decorate([
    (0, common_1.Injectable)()
], HttpLoggingInterceptor);
//# sourceMappingURL=http-logging.interceptor.js.map