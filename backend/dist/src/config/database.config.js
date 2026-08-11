"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = () => ({
    database: {
        host: process.env.DB_HOST ?? 'localhost',
        port: parseInt(process.env.DB_PORT ?? '5432', 10),
        username: process.env.DB_USERNAME ?? 'postgres',
        password: process.env.DB_PASSWORD ?? '',
        name: process.env.DB_NAME ?? 'actpulse',
        synchronize: (process.env.DB_SYNCHRONIZE ?? 'true') === 'true',
        logging: (process.env.DB_LOGGING ?? 'false') === 'true',
    },
});
//# sourceMappingURL=database.config.js.map