"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const typeorm_1 = require("typeorm");
const AppDataSource = new typeorm_1.DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: ['src/modules/**/*.entity.ts', 'dist/modules/**/*.entity.js'],
    migrations: ['src/database/migrations/*.ts', 'dist/database/migrations/*.js'],
    synchronize: false,
    logging: false,
});
exports.default = AppDataSource;
//# sourceMappingURL=ormconfig.js.map