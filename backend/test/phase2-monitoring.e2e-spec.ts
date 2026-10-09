/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-require-imports -- Supertest response bodies and the database configuration are loaded dynamically. */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { Client } from 'pg';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { UserRole } from '../src/common/enums/user-role.enum';
import { MailService } from '../src/modules/mail/mail.service';
import { User } from '../src/modules/users/user.entity';

jest.setTimeout(60000);

describe('Phase 02 site, equipment and monitoring flow', () => {
  const originalDb = process.env.DB_NAME;
  const database = `actpulse_monitoring_test_${Date.now()}`;
  let app: INestApplication;
  let adminToken: string;

  const databaseClient = () =>
    new Client({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: 'postgres',
    });

  beforeAll(async () => {
    require('dotenv').config({ quiet: true });
    const client = databaseClient();
    await client.connect();
    try {
      await client.query(`CREATE DATABASE "${database}" TEMPLATE template0`);
    } finally {
      await client.end();
    }
    process.env.DB_NAME = database;
    process.env.JWT_SECRET = 'phase-two-monitoring-test-jwt-secret-32-bytes';
    const migrationSource: DataSource = require('../ormconfig').default;
    await migrationSource.initialize();
    await migrationSource.runMigrations();
    await migrationSource.destroy();
    const { AppModule } = require('../src/app.module');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue({})
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.listen(0);
    const dataSource = app.get(DataSource);
    await dataSource.getRepository(User).save({
      name: 'Monitoring Admin',
      email: 'monitoring-admin@example.test',
      password: await bcrypt.hash('Test-Admin-Pass-123', 12),
      role: UserRole.ADMIN,
      isActive: true,
      isActivated: true,
      organizationId: null,
      tokenVersion: 0,
    });
    const login = await request(app.getHttpServer()).post('/auth/login').send({
      email: 'monitoring-admin@example.test',
      password: 'Test-Admin-Pass-123',
    });
    expect(login.status).toBe(201);
    adminToken = login.body.accessToken;
  });

  afterAll(async () => {
    if (app) await app.close();
    process.env.DB_NAME = originalDb;
    const client = databaseClient();
    await client.connect();
    try {
      await client.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    } finally {
      await client.end();
    }
  });

  it('creates a site and equipment, ingests observations, rotates a credential, and scopes reports', async () => {
    const http = request(app.getHttpServer());
    const authorized = (path: string) =>
      http.get(path).set('Authorization', `Bearer ${adminToken}`);
    const org = await http
      .post('/organizations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test Customer' });
    expect(org.status).toBe(201);
    const trial = await http
      .post('/subscriptions/select')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        organizationId: org.body.id,
        planCode: 'OPERATIONS',
        billingCycle: 'MONTHLY',
        idempotencyKey: 'monitoring-flow-initial-selection',
      });
    expect(trial.status).toBe(201);
    const site = await http
      .post('/sites')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        organizationId: org.body.id,
        name: 'Main Site',
        timezone: 'Africa/Dar_es_Salaam',
      });
    expect(site.status).toBe(201);
    const equipment = await http
      .post('/equipment')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        organizationId: org.body.id,
        siteId: site.body.id,
        name: 'Generator One',
        type: 'GENERATOR',
        monitoringDefinition: 'ENGINE_RUNNING',
        openingRunningHours: 100,
        openingHoursAt: '2026-01-01T00:00:00Z',
      });
    expect(equipment.status).toBe(201);
    const monitor = await http
      .post('/devices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        organizationId: org.body.id,
        siteId: site.body.id,
        equipmentId: equipment.body.id,
        name: 'Monitor One',
        deviceIdentifier: 'monitor-one',
      });
    expect(monitor.status).toBe(201);
    expect(monitor.body.apiKey).toMatch(/^ap_/);
    expect(JSON.stringify((await authorized('/devices')).body)).not.toContain(
      monitor.body.apiKey,
    );
    const key = monitor.body.apiKey;
    const first = await http
      .post('/sensors/status')
      .set('Authorization', `ApiKey ${key}`)
      .send({ status: 'ON', eventId: 'event-1' });
    expect(first.status).toBe(201);
    const duplicate = await http
      .post('/sensors/status')
      .set('Authorization', `ApiKey ${key}`)
      .send({ status: 'ON', eventId: 'event-1' });
    expect(duplicate.status).toBe(201);
    const detail = await authorized(`/equipment/${equipment.body.id}`);
    if (detail.status !== 200) throw new Error(JSON.stringify(detail.body));
    expect(detail.body.snapshot.state).toBe('ON');
    const report = await authorized('/reports/equipment').query({
      equipmentId: equipment.body.id,
      preset: 'today',
    });
    expect(report.status).toBe(200);
    const rotated = await http
      .post(`/devices/${monitor.body.device.id}/rotate-key`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(rotated.status).toBe(201);
    expect(
      (
        await http
          .post('/sensors/heartbeat')
          .set('Authorization', `ApiKey ${key}`)
          .send({})
      ).status,
    ).toBe(401);
    expect(
      (
        await http
          .post('/sensors/heartbeat')
          .set('Authorization', `ApiKey ${rotated.body.apiKey}`)
          .send({ status: 'ON' })
      ).status,
    ).toBe(201);

    const tank = await http
      .post(`/fuel/${equipment.body.id}/tank`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        capacityLitres: '100.000',
        name: 'Main tank',
        reason: 'Commissioning',
      });
    expect(tank.status).toBe(201);
    const now = Date.now();
    const opening = await http
      .post(`/fuel/${equipment.body.id}/readings`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        observedAt: new Date(now - 3 * 3600000).toISOString(),
        levelLitres: '80.000',
        method: 'Dipstick',
      });
    expect(opening.status).toBe(201);
    const refill = await http
      .post(`/fuel/${equipment.body.id}/refills`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        occurredAt: new Date(now - 2 * 3600000).toISOString(),
        quantityLitres: '20.000',
        unitPrice: '2500.1234',
        currency: 'TZS',
        additionalCost: '5.0000',
      });
    expect(refill.status).toBe(201);
    expect(refill.body.total_amount).toBe('50007.4680');
    const overCapacity = await http
      .post(`/fuel/${equipment.body.id}/readings`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ observedAt: new Date().toISOString(), levelLitres: '101.000' });
    expect(overCapacity.status).toBe(400);
    const closing = await http
      .post(`/fuel/${equipment.body.id}/readings`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        observedAt: new Date(now - 3600000).toISOString(),
        levelLitres: '70.000',
      });
    expect(closing.status).toBe(201);
    const rate = await http
      .post(`/fuel/${equipment.body.id}/estimates`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        effectiveFrom: new Date(now - 4 * 3600000).toISOString(),
        litresPerHour: '2.5000',
        basis: 'Manufacturer reference',
      });
    expect(rate.status).toBe(201);
    const reconciliation = await http
      .post(`/fuel/${equipment.body.id}/reconciliations`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        openingReadingId: opening.body.id,
        closingReadingId: closing.body.id,
      });
    expect(reconciliation.status).toBe(201);
    expect(reconciliation.body.apparent_usage_litres).toBe('30.000');
    const finalized = await http
      .post(`/fuel/reconciliations/${reconciliation.body.id}/finalize`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ note: 'Reviewed receipt and readings' });
    expect(finalized.status).toBe(201);
    const frozen = await http
      .post(`/fuel/readings/${opening.body.id}/void`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Try to change finalized source' });
    expect(frozen.status).toBe(400);
    const plan = await http
      .post('/maintenance/plans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        equipmentId: equipment.body.id,
        title: 'Oil service',
        trigger: 'CALENDAR',
        intervalDays: 30,
        referenceServiceAt: new Date(now - 29 * 86400000).toISOString(),
      });
    expect(plan.status).toBe(201);
    const service = await http
      .post('/maintenance/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        equipmentId: equipment.body.id,
        planId: plan.body.id,
        performedAt: new Date().toISOString(),
        description: 'Oil changed',
        resetsPlanBaseline: true,
      });
    expect(service.status).toBe(201);
    const rule = await http
      .post('/alerts/rules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        organizationId: org.body.id,
        equipmentId: equipment.body.id,
        type: 'LOW_FUEL',
        severity: 'WARNING',
        threshold: '75.000',
        freshnessMinutes: 240,
        reason: 'Operations threshold',
      });
    expect(rule.status).toBe(201);
    const alerts = await authorized('/alerts').query({ status: 'OPEN' });
    expect(alerts.status).toBe(200);
    expect(alerts.body.items.length).toBe(1);
    const ack = await http
      .post(`/alerts/${alerts.body.items[0].id}/acknowledge`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ note: 'Reviewing' });
    expect(ack.status).toBe(201);
    if (ack.body.status !== 'ACKNOWLEDGED')
      throw new Error(JSON.stringify(ack.body));
    const notifications = await authorized('/notifications');
    expect(notifications.status).toBe(200);
    expect(notifications.body.unread).toBe(1);
    const readingRecovery = await http
      .post(`/fuel/${equipment.body.id}/readings`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ observedAt: new Date().toISOString(), levelLitres: '90.000' });
    expect(readingRecovery.status).toBe(201);
    const resolved = await authorized('/alerts').query({ status: 'RESOLVED' });
    expect(resolved.body.items.length).toBe(1);
    const operations = await authorized('/reports/operations').query({
      type: 'costs',
      equipmentId: equipment.body.id,
      preset: 'today',
    });
    expect(operations.status).toBe(200);
    expect(operations.body.summary.byCurrency[0].amount).toBe('50007.4680');
    const csv = await authorized('/reports/operations/export.csv').query({
      type: 'costs',
      equipmentId: equipment.body.id,
      preset: 'today',
    });
    expect(csv.status).toBe(200);
    expect(csv.text).toContain('50007.4680');
    expect(csv.text).toContain('"PURCHASE"');

    await app
      .get(DataSource)
      .query('UPDATE equipment SET name=$2 WHERE id=$1', [
        equipment.body.id,
        '=2+2',
      ]);
    const safeCsv = await authorized('/reports/operations/export.csv').query({
      type: 'costs',
      equipmentId: equipment.body.id,
      preset: 'today',
    });
    expect(safeCsv.text).toContain('"\'=2+2"');
    await app
      .get(DataSource)
      .query('UPDATE equipment SET name=$2 WHERE id=$1', [
        equipment.body.id,
        'Generator One',
      ]);

    const dataSource = app.get(DataSource);
    const controller = await dataSource.getRepository(User).save({
      name: 'Assigned Operator',
      email: 'assigned-operator@example.test',
      password: await bcrypt.hash('Controller-Pass-123', 12),
      role: UserRole.CONTROLLER,
      isActive: true,
      isActivated: true,
      organizationId: org.body.id,
      tokenVersion: 0,
    });
    await dataSource.query(
      'INSERT INTO user_equipment(user_id,equipment_id) VALUES($1,$2)',
      [controller.id, equipment.body.id],
    );
    const controllerLogin = await http.post('/auth/login').send({
      email: 'assigned-operator@example.test',
      password: 'Controller-Pass-123',
    });
    expect(controllerLogin.status).toBe(201);
    const controllerToken = controllerLogin.body.accessToken;
    const controllerReading = await http
      .post(`/fuel/${equipment.body.id}/readings`)
      .set('Authorization', `Bearer ${controllerToken}`)
      .send({ observedAt: new Date().toISOString(), levelLitres: '88.000' });
    expect(controllerReading.status).toBe(201);
    const corrected = await http
      .post(`/fuel/readings/${controllerReading.body.id}/correct`)
      .set('Authorization', `Bearer ${controllerToken}`)
      .send({
        observedAt: new Date().toISOString(),
        levelLitres: '87.500',
        correctionReason: 'Corrected dipstick transcription',
      });
    expect(corrected.status).toBe(201);
    expect(corrected.body.corrected_from_id).toBe(controllerReading.body.id);
    expect(corrected.body.level_litres).toBe('87.500');
    const readingHistory = await app
      .get(DataSource)
      .query('SELECT voided_at FROM fuel_readings WHERE id=$1', [
        controllerReading.body.id,
      ]);
    expect(readingHistory[0].voided_at).toBeTruthy();
    const controllerService = await http
      .post('/maintenance/services')
      .set('Authorization', `Bearer ${controllerToken}`)
      .send({
        equipmentId: equipment.body.id,
        performedAt: new Date().toISOString(),
        description: 'Filter inspection',
      });
    expect(controllerService.status).toBe(201);
    const correctedService = await http
      .post(`/maintenance/services/${controllerService.body.id}/correct`)
      .set('Authorization', `Bearer ${controllerToken}`)
      .send({
        performedAt: controllerService.body.performed_at,
        description: 'Filter replaced',
        correctionReason: 'Updated service notes',
      });
    expect(correctedService.status).toBe(201);
    expect(correctedService.body.corrected_from_id).toBe(
      controllerService.body.id,
    );
    expect(
      (
        await http
          .post(`/fuel/readings/${opening.body.id}/correct`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            observedAt: opening.body.observed_at,
            levelLitres: '1',
            correctionReason: 'Attempt frozen correction',
          })
      ).status,
    ).toBe(400);
    expect(
      (
        await http
          .post('/alerts/rules')
          .set('Authorization', `Bearer ${controllerToken}`)
          .send({})
      ).status,
    ).toBe(403);
    const otherOrg = await http
      .post('/organizations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Other Customer' });
    expect(
      (
        await http
          .post('/subscriptions/select')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            organizationId: otherOrg.body.id,
            planCode: 'STARTER',
            billingCycle: 'MONTHLY',
            idempotencyKey: 'other-customer-initial-selection',
          })
      ).status,
    ).toBe(201);
    const otherSite = await http
      .post('/sites')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ organizationId: otherOrg.body.id, name: 'Other Site' });
    const otherEquipment = await http
      .post('/equipment')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        organizationId: otherOrg.body.id,
        siteId: otherSite.body.id,
        name: 'Other Generator',
        type: 'GENERATOR',
        monitoringDefinition: 'ENGINE_RUNNING',
      });
    expect(
      (
        await http
          .get(`/fuel/${otherEquipment.body.id}`)
          .set('Authorization', `Bearer ${controllerToken}`)
      ).status,
    ).toBe(404);
    expect(
      (
        await http
          .get('/reports/operations')
          .set('Authorization', `Bearer ${controllerToken}`)
          .query({ type: 'fuel', equipmentId: otherEquipment.body.id })
      ).status,
    ).toBe(404);
  });
});
