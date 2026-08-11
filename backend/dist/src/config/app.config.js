"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = () => ({
    port: parseInt(process.env.PORT ?? '3000', 10),
    jwtSecret: process.env.JWT_SECRET ?? 'actpulse_dev_secret',
});
//# sourceMappingURL=app.config.js.map