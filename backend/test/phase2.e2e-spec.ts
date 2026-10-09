/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/require-await, @typescript-eslint/no-unsafe-argument -- Jest loads the database configuration after environment setup, and Supertest response bodies are untyped. */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { Client } from 'pg';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../src/common/enums/user-role.enum';
import { MailService } from '../src/modules/mail/mail.service';
import { User } from '../src/modules/users/user.entity';

jest.setTimeout(60000);

describe('Phase 02 account and customer isolation', () => {
  const originalDb = process.env.DB_NAME;
  const database = `actpulse_phase2_test_${Date.now()}`;
  const adminEmail = 'phase2-admin@example.test';
  const adminPassword = 'Test-Admin-Pass-123';
  const invitations = new Map<string, { otp: string; token: string }>();
  const resetCodes = new Map<string, string>();
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let controllerAToken: string;
  let controllerBToken: string;
  let organizationA: string;
  let organizationB: string;
  let siteA: string;
  let siteB: string;
  let deviceA: string;
  let deviceB: string;
  let deviceAKey: string;

  const databaseClient = () =>
    new Client({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: 'postgres',
    });

  const provisionMonitor = async (
    organizationId: string,
    siteId: string,
    name: string,
  ) => {
    const equipment = await request(app.getHttpServer())
      .post('/equipment')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        organizationId,
        siteId,
        name,
        type: 'GENERATOR',
        monitoringDefinition: 'ENGINE_RUNNING',
      });
    expect(equipment.status).toBe(201);
    return request(app.getHttpServer())
      .post('/devices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        organizationId,
        siteId,
        equipmentId: equipment.body.id,
        name,
        deviceIdentifier: `test-${name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`,
      });
  };

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
    process.env.JWT_SECRET = 'phase-two-test-jwt-secret-at-least-32-bytes';
    process.env.AUTH_VERIFY_LIMIT = '100';
    const migrationSource: DataSource = require('../ormconfig').default;
    await migrationSource.initialize();
    await migrationSource.runMigrations();
    await migrationSource.destroy();
    const { AppModule } = require('../src/app.module');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue({
        sendUserInvitation: async (
          email: string,
          otp: string,
          token: string,
        ) => {
          if (email === 'delivery-fail@example.test')
            throw new Error('Mock SMTP failure');
          invitations.set(email, { otp, token });
        },
        sendOtpReset: async (email: string, otp: string) => {
          resetCodes.set(email, otp);
        },
        sendPasswordChanged: async () => undefined,
      })
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
    dataSource = app.get(DataSource);
    await dataSource.getRepository(User).save({
      name: 'Phase 2 Admin',
      email: adminEmail,
      password: await bcrypt.hash(adminPassword, 12),
      role: UserRole.ADMIN,
      isActive: true,
      isActivated: true,
      organizationId: null,
      tokenVersion: 0,
    });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, password: adminPassword });
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

  it('provisions two organizations and devices without exposing keys in ordinary responses', async () => {
    const a = await request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Customer A' });
    const b = await request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Customer B' });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    organizationA = a.body.id;
    organizationB = b.body.id;
    for (const [organizationId, key] of [
      [organizationA, 'A'],
      [organizationB, 'B'],
    ]) {
      const selection = await request(app.getHttpServer())
        .post('/subscriptions/select')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          organizationId,
          planCode: 'BUSINESS',
          billingCycle: 'MONTHLY',
          idempotencyKey: `account-isolation-${key}`,
        });
      expect(selection.status).toBe(201);
    }
    const aSite = await request(app.getHttpServer())
      .post('/sites')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ organizationId: organizationA, name: 'Site A' });
    const bSite = await request(app.getHttpServer())
      .post('/sites')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ organizationId: organizationB, name: 'Site B' });
    expect(aSite.status).toBe(201);
    expect(bSite.status).toBe(201);
    siteA = aSite.body.id;
    siteB = bSite.body.id;
    const first = await provisionMonitor(organizationA, siteA, 'Generator A');
    const second = await provisionMonitor(organizationB, siteB, 'Generator B');
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    deviceA = first.body.device.id;
    deviceB = second.body.device.id;
    deviceAKey = first.body.apiKey;
    expect(deviceAKey).toBeTruthy();
    const ordinary = await request(app.getHttpServer())
      .get('/devices')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(ordinary.status).toBe(200);
    expect(JSON.stringify(ordinary.body)).not.toContain('apiKey');
  });

  it('requires both invitation secrets, then allows an empty assignment', async () => {
    const inviteA = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Controller A',
        email: 'controller-a@example.test',
        organizationId: organizationA,
        deviceIds: [],
      });
    const inviteB = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Controller B',
        email: 'controller-b@example.test',
        organizationId: organizationB,
        deviceIds: [deviceB],
      });
    expect(inviteA.status).toBe(201);
    expect(inviteB.status).toBe(201);
    const roleInjection = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Wrong Role',
        email: 'wrong-role@example.test',
        organizationId: organizationA,
        deviceIds: [],
        role: 'Admin',
      });
    expect(roleInjection.status).toBe(400);
    expect(inviteA.body.user.equipmentIds).toEqual([]);
    expect(JSON.stringify(inviteA.body)).not.toContain('password');
    expect(JSON.stringify(inviteA.body)).not.toContain('apiKey');
    const a = invitations.get('controller-a@example.test')!;
    const b = invitations.get('controller-b@example.test')!;
    const missingToken = await request(app.getHttpServer())
      .post('/users/activate')
      .send({
        email: 'controller-a@example.test',
        otp: a.otp,
        password: 'Controller-A-Pass-123',
      });
    expect(missingToken.status).toBe(400);
    const badCode = await request(app.getHttpServer())
      .post('/users/activate')
      .send({
        email: 'controller-a@example.test',
        otp: '000000',
        token: a.token,
        password: 'Controller-A-Pass-123',
      });
    expect(badCode.status).toBe(400);
    for (const [email, secrets, password] of [
      ['controller-a@example.test', a, 'Controller-A-Pass-123'],
      ['controller-b@example.test', b, 'Controller-B-Pass-123'],
    ] as const) {
      const result = await request(app.getHttpServer())
        .post('/users/activate')
        .send({ email, otp: secrets.otp, token: secrets.token, password });
      expect(result.status).toBe(201);
      const reused = await request(app.getHttpServer())
        .post('/users/activate')
        .send({ email, otp: secrets.otp, token: secrets.token, password });
      expect(reused.status).toBe(400);
    }
    controllerAToken = (
      await request(app.getHttpServer()).post('/auth/login').send({
        email: 'controller-a@example.test',
        password: 'Controller-A-Pass-123',
      })
    ).body.accessToken;
    controllerBToken = (
      await request(app.getHttpServer()).post('/auth/login').send({
        email: 'controller-b@example.test',
        password: 'Controller-B-Pass-123',
      })
    ).body.accessToken;
    expect(controllerAToken).toBeTruthy();
    expect(controllerBToken).toBeTruthy();
  });

  it('denies other organizations, unassigned devices, and Controller management', async () => {
    const empty = await request(app.getHttpServer())
      .get('/devices')
      .set('Authorization', `Bearer ${controllerAToken}`);
    expect(empty.body).toEqual([]);
    const other = await request(app.getHttpServer())
      .get(`/devices/${deviceB}`)
      .set('Authorization', `Bearer ${controllerAToken}`);
    expect(other.status).toBe(404);
    const report = await request(app.getHttpServer())
      .get('/reports/device-uptime')
      .set('Authorization', `Bearer ${controllerAToken}`)
      .query({
        deviceId: deviceB,
        from: '2026-01-01T00:00:00Z',
        to: '2026-01-02T00:00:00Z',
      });
    expect(report.status).toBe(404);
    const listUsers = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${controllerAToken}`);
    expect(listUsers.status).toBe(403);
    const listOrganizations = await request(app.getHttpServer())
      .get('/organizations')
      .set('Authorization', `Bearer ${controllerAToken}`);
    expect(listOrganizations.status).toBe(403);
    const createDevice = await request(app.getHttpServer())
      .post('/devices')
      .set('Authorization', `Bearer ${controllerAToken}`)
      .send({
        name: 'Illicit',
        location: 'Site',
        organizationId: organizationA,
      });
    expect(createDevice.status).toBe(403);
    const transfer = await request(app.getHttpServer())
      .patch(`/devices/${deviceA}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ organizationId: organizationB });
    expect(transfer.status).toBe(400);
    const users = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(users.status).toBe(200);
    const controllerA = users.body.items.find(
      (user: { email: string }) => user.email === 'controller-a@example.test',
    );
    const crossAssignment = await request(app.getHttpServer())
      .post(`/users/${controllerA.id}/assign-devices`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ deviceIds: [deviceB] });
    expect(crossAssignment.status).toBe(400);
    const assignment = await request(app.getHttpServer())
      .post(`/users/${controllerA.id}/assign-devices`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ deviceIds: [deviceA] });
    expect(assignment.status).toBe(201);
    const oldSession = await request(app.getHttpServer())
      .get('/devices')
      .set('Authorization', `Bearer ${controllerAToken}`);
    expect(oldSession.status).toBe(401);
    controllerAToken = (
      await request(app.getHttpServer()).post('/auth/login').send({
        email: 'controller-a@example.test',
        password: 'Controller-A-Pass-123',
      })
    ).body.accessToken;
    const assigned = await request(app.getHttpServer())
      .get('/devices')
      .set('Authorization', `Bearer ${controllerAToken}`);
    expect(assigned.body.map((device: { id: string }) => device.id)).toEqual([
      deviceA,
    ]);
  });

  it('restricts profile fields and invalidates sessions on password change', async () => {
    const denied = await request(app.getHttpServer())
      .patch('/auth/me')
      .set('Authorization', `Bearer ${controllerAToken}`)
      .send({ name: 'Renamed', role: 'Admin' });
    expect(denied.status).toBe(400);
    const renamed = await request(app.getHttpServer())
      .patch('/auth/me')
      .set('Authorization', `Bearer ${controllerAToken}`)
      .send({ name: 'Renamed Controller' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.name).toBe('Renamed Controller');
    expect(renamed.body.organization.id).toBe(organizationA);
    expect(JSON.stringify(renamed.body)).not.toContain('password');
    const changed = await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${controllerAToken}`)
      .send({
        oldPassword: 'Controller-A-Pass-123',
        newPassword: 'Controller-A-New-Pass-123',
      });
    expect(changed.status).toBe(201);
    expect(
      (
        await request(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', `Bearer ${controllerAToken}`)
      ).status,
    ).toBe(401);
    controllerAToken = (
      await request(app.getHttpServer()).post('/auth/login').send({
        email: 'controller-a@example.test',
        password: 'Controller-A-New-Pass-123',
      })
    ).body.accessToken;
    expect(controllerAToken).toBeTruthy();
  });

  it('invalidates old invitations, expires reset codes, and limits failed verification', async () => {
    const pendingEmail = 'pending-c@example.test';
    const invited = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Pending C',
        email: pendingEmail,
        organizationId: organizationA,
        deviceIds: [],
      });
    expect(invited.status).toBe(201);
    const old = invitations.get(pendingEmail)!;
    const resent = await request(app.getHttpServer())
      .post(`/users/${invited.body.user.id}/resend-invitation`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resent.status).toBe(201);
    const current = invitations.get(pendingEmail)!;
    expect(current.token).not.toBe(old.token);
    expect(
      (
        await request(app.getHttpServer()).post('/users/activate').send({
          email: pendingEmail,
          otp: old.otp,
          token: old.token,
          password: 'Pending-C-Pass-123',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app.getHttpServer()).post('/users/activate').send({
          email: pendingEmail,
          otp: current.otp,
          token: current.token,
          password: 'Pending-C-Pass-123',
        })
      ).status,
    ).toBe(201);
    const failedDelivery = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Delivery Failure',
        email: 'delivery-fail@example.test',
        organizationId: organizationA,
        deviceIds: [],
      });
    expect(failedDelivery.status).toBeGreaterThanOrEqual(500);
    const records = await dataSource.query(
      'SELECT count(*)::int AS total FROM users WHERE email = $1',
      ['delivery-fail@example.test'],
    );
    expect(records[0].total).toBe(0);

    const email = 'controller-b@example.test';
    expect(
      (
        await request(app.getHttpServer())
          .post('/auth/forgot-password')
          .send({ email })
      ).status,
    ).toBe(201);
    const expired = resetCodes.get(email)!;
    await dataSource.query(
      "UPDATE password_otps SET expires_at = now() - interval '1 minute' WHERE email = $1 AND purpose = 'FORGOT_PASSWORD' AND used = false",
      [email],
    );
    expect(
      (
        await request(app.getHttpServer()).post('/auth/reset-password').send({
          email,
          otp: expired,
          newPassword: 'Controller-B-New-Pass-123',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app.getHttpServer())
          .post('/auth/forgot-password')
          .send({ email })
      ).status,
    ).toBe(201);
    const currentReset = resetCodes.get(email)!;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const invalid = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({
          email,
          otp: 'not-it',
          newPassword: 'Controller-B-New-Pass-123',
        });
      expect(invalid.status).toBe(400);
    }
    const locked = await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({
        email,
        otp: currentReset,
        newPassword: 'Controller-B-New-Pass-123',
      });
    expect(locked.status).toBe(400);
    expect(
      (
        await request(app.getHttpServer())
          .post('/auth/forgot-password')
          .send({ email })
      ).status,
    ).toBe(201);
    const finalCode = resetCodes.get(email)!;
    const reset = await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({
        email,
        otp: finalCode,
        newPassword: 'Controller-B-New-Pass-123',
      });
    expect(reset.status).toBe(201);
    expect(
      (
        await request(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', `Bearer ${controllerBToken}`)
      ).status,
    ).toBe(401);
    controllerBToken = (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'Controller-B-New-Pass-123' })
    ).body.accessToken;
    expect(controllerBToken).toBeTruthy();
  });

  it('keeps a reactivated invitation pending', async () => {
    const email = 'pending-d@example.test';
    const invitation = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Pending D',
        email,
        organizationId: organizationA,
        deviceIds: [],
      });
    expect(invitation.status).toBe(201);
    const id = invitation.body.user.id;
    expect(
      (
        await request(app.getHttpServer())
          .delete(`/users/${id}`)
          .set('Authorization', `Bearer ${adminToken}`)
      ).status,
    ).toBe(200);
    const restored = await request(app.getHttpServer())
      .post(`/users/${id}/reactivate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(restored.status).toBe(201);
    expect(restored.body.isActivated).toBe(false);
    expect(
      (
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email, password: 'Pending-D-Pass-123' })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app.getHttpServer())
          .post('/auth/forgot-password')
          .send({ email })
      ).status,
    ).toBe(201);
    expect(resetCodes.has(email)).toBe(false);
  });

  it('uses the same token invalidation for HTTP and active sockets', async () => {
    const { io } = require('../../frontend/node_modules/socket.io-client');
    const port = app.getHttpServer().address().port;
    const connect = async (token: string) => {
      const client = io(`http://127.0.0.1:${port}`, {
        auth: { token: `Bearer ${token}` },
        transports: ['websocket'],
        reconnection: false,
      });
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('Socket did not connect')),
          3000,
        );
        client.once('connect', () => {
          clearTimeout(timer);
          resolve();
        });
        client.once('connect_error', (error: Error) => {
          clearTimeout(timer);
          reject(error);
        });
      });
      return client;
    };
    const socket = await connect(controllerAToken);
    const adminSocket = await connect(adminToken);
    const otherCustomerSocket = await connect(controllerBToken);
    const created = await provisionMonitor(
      organizationA,
      siteA,
      'Unassigned A Device',
    );
    expect(created.status).toBe(201);
    let otherReceived = false;
    otherCustomerSocket.on('device.status.updated', () => {
      otherReceived = true;
    });
    const adminReceived = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Admin did not receive status')),
        3000,
      );
      adminSocket.once('device.status.updated', () => {
        clearTimeout(timer);
        resolve();
      });
    });
    const status = await request(app.getHttpServer())
      .post('/sensors/status')
      .set('Authorization', `ApiKey ${created.body.apiKey}`)
      .send({ status: 'ON' });
    expect(status.status).toBe(201);
    await adminReceived;
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(otherReceived).toBe(false);
    adminSocket.disconnect();
    otherCustomerSocket.disconnect();
    const disconnected = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Socket remained connected')),
        3000,
      );
      socket.once('disconnect', () => {
        clearTimeout(timer);
        resolve();
      });
    });
    const logout = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${controllerAToken}`)
      .send({});
    expect(logout.status).toBe(201);
    await disconnected;
    expect(
      (
        await request(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', `Bearer ${controllerAToken}`)
      ).status,
    ).toBe(401);
    controllerAToken = (
      await request(app.getHttpServer()).post('/auth/login').send({
        email: 'controller-a@example.test',
        password: 'Controller-A-New-Pass-123',
      })
    ).body.accessToken;
  });

  it('disconnects an established socket when its JWT expires', async () => {
    const { io } = require('../../frontend/node_modules/socket.io-client');
    const port = app.getHttpServer().address().port;
    const user = await dataSource
      .getRepository(User)
      .findOneOrFail({ where: { email: 'controller-a@example.test' } });
    const jwt = app.get(JwtService);
    const shortToken = await jwt.signAsync(
      { sub: user.id, tokenVersion: user.tokenVersion },
      { expiresIn: '2s' },
    );
    const socket = io(`http://127.0.0.1:${port}`, {
      auth: { token: `Bearer ${shortToken}` },
      transports: ['websocket'],
      reconnection: false,
    });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Short-lived socket did not connect')),
        3000,
      );
      socket.once('connect', () => {
        clearTimeout(timer);
        resolve();
      });
      socket.once('connect_error', (error: Error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Expired socket remained connected')),
        4000,
      );
      socket.once('disconnect', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  });

  it('blocks inactive organization access and device ingestion without changing device flags', async () => {
    const deactivated = await request(app.getHttpServer())
      .post(`/organizations/${organizationA}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deactivated.status).toBe(201);
    expect(
      (
        await request(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', `Bearer ${controllerAToken}`)
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app.getHttpServer())
          .post('/sensors/heartbeat')
          .set('Authorization', `ApiKey ${deviceAKey}`)
          .send({})
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', `Bearer ${controllerBToken}`)
      ).status,
    ).toBe(200);
    const adminDevice = await request(app.getHttpServer())
      .get(`/devices/${deviceA}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminDevice.body.isActive).toBe(true);
  });
});
