/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-require-imports -- Supertest bodies and dynamic test database configuration. */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { Client } from 'pg';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { UserRole } from '../src/common/enums/user-role.enum';
import { MailService } from '../src/modules/mail/mail.service';
import { User } from '../src/modules/users/user.entity';
import { addCalendarMonths } from '../src/modules/billing/billing.service';
import { seedSubscriptionPlans } from '../src/scripts/seed-subscription-plans';
import { BillingRemindersService } from '../src/modules/billing/reminders.service';

jest.setTimeout(60000);
describe('Phase 02 subscription and manual billing', () => {
  const originalDb = process.env.DB_NAME;
  const database = `actpulse_billing_test_${Date.now()}`;
  let app: INestApplication,
    db: DataSource,
    adminToken: string,
    controllerToken: string,
    orgId: string;
  const client = (): Client =>
    new Client({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: 'postgres',
    });
  beforeAll(async () => {
    require('dotenv').config({ quiet: true });
    const c = client();
    await c.connect();
    try {
      await c.query(`CREATE DATABASE "${database}" TEMPLATE template0`);
    } finally {
      await c.end();
    }
    process.env.DB_NAME = database;
    process.env.JWT_SECRET = 'phase-two-billing-test-secret-32-bytes';
    const source: DataSource = require('../ormconfig').default;
    await source.initialize();
    await source.runMigrations();
    await source.destroy();
    const { AppModule } = require('../src/app.module');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue({ sendUserInvitation: jest.fn().mockResolvedValue(undefined) })
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
    db = app.get(DataSource);
    await db.getRepository(User).save({
      name: 'Billing Admin',
      email: 'billing-admin@example.test',
      password: await bcrypt.hash('Billing-Admin-123', 12),
      role: UserRole.ADMIN,
      isActive: true,
      isActivated: true,
      organizationId: null,
      tokenVersion: 0,
    });
    const login = await request(app.getHttpServer()).post('/auth/login').send({
      email: 'billing-admin@example.test',
      password: 'Billing-Admin-123',
    });
    expect(login.status).toBe(201);
    adminToken = login.body.accessToken;
  });
  afterAll(async () => {
    if (app) await app.close();
    process.env.DB_NAME = originalDb;
    const c = client();
    await c.connect();
    try {
      await c.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    } finally {
      await c.end();
    }
  });
  it('starts one trial, enforces limits, reviews partial/full payment and preserves expiry access policy', async () => {
    expect(
      addCalendarMonths(new Date('2026-01-31T10:00:00.123Z'), 1).toISOString(),
    ).toBe('2026-02-28T10:00:00.123Z');
    expect(
      addCalendarMonths(new Date('2026-02-28T10:00:00.123Z'), 1).toISOString(),
    ).toBe('2026-03-31T10:00:00.123Z');
    const http = request(app.getHttpServer());
    const admin = (path: string) =>
      http.get(path).set('Authorization', `Bearer ${adminToken}`);
    const plans = await admin('/subscriptions/plans');
    expect(plans.status).toBe(200);
    expect(plans.body.map((p: { code: string }) => p.code)).toEqual([
      'STARTER',
      'OPERATIONS',
      'BUSINESS',
    ]);
    expect(plans.body[0].monthly_price).toBe('30000.0000');
    await db.query(
      "UPDATE subscription_plans SET monthly_price=76000 WHERE code='OPERATIONS'",
    );
    await seedSubscriptionPlans(db);
    await seedSubscriptionPlans(db);
    expect(
      (
        await db.query(
          "SELECT monthly_price FROM subscription_plans WHERE code='OPERATIONS'",
        )
      )[0].monthly_price,
    ).toBe('76000.0000');
    const org = await http
      .post('/organizations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Billing Customer' });
    expect(org.status).toBe(201);
    orgId = org.body.id;
    const invited = await http
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'First Controller',
        email: 'billing-controller@example.test',
        organizationId: orgId,
      });
    expect(invited.status).toBe(201);
    await db.query(
      'UPDATE users SET password=$2,is_activated=true WHERE id=$1',
      [invited.body.user.id, await bcrypt.hash('Billing-Controller-123', 12)],
    );
    const login = await http.post('/auth/login').send({
      email: 'billing-controller@example.test',
      password: 'Billing-Controller-123',
    });
    expect(login.status).toBe(201);
    expect(login.body.user.organizationId).toBe(orgId);
    expect(login.body.user.organization.id).toBe(orgId);
    controllerToken = login.body.accessToken;
    const controller = (path: string) =>
      http.get(path).set('Authorization', `Bearer ${controllerToken}`);
    expect((await controller('/auth/me')).body.organizationId).toBe(orgId);
    const noPlan = await controller('/sites');
    expect(noPlan.status).toBe(403);
    expect(noPlan.body.code).toBe('SUBSCRIPTION_REQUIRED');
    const initialStatus = await controller('/subscriptions/status');
    expect(initialStatus.body.organizationId).toBe(orgId);
    expect(initialStatus.body.state).toBe('NONE');
    const selection = {
      planCode: 'STARTER',
      billingCycle: 'MONTHLY',
      idempotencyKey: 'starter-first',
    };
    const first = await http
      .post('/subscriptions/select')
      .set('Authorization', `Bearer ${controllerToken}`)
      .send(selection);
    expect(first.status).toBe(201);
    expect(first.body.trialStarted).toBe(true);
    const repeated = await http
      .post('/subscriptions/select')
      .set('Authorization', `Bearer ${controllerToken}`)
      .send(selection);
    expect(repeated.status).toBe(201);
    expect(repeated.body.invoiceId).toBe(first.body.invoiceId);
    const repeatedClick = await http
      .post('/subscriptions/select')
      .set('Authorization', `Bearer ${controllerToken}`)
      .send({ ...selection, idempotencyKey: 'starter-second-click' });
    expect(repeatedClick.status).toBe(201);
    expect(repeatedClick.body.invoiceId).toBe(first.body.invoiceId);
    const trial = await controller('/subscriptions/status');
    expect(trial.body.state).toBe('TRIALING');
    expect(
      new Date(trial.body.trialEndsAt).getTime() -
        new Date(trial.body.trialStartedAt).getTime(),
    ).toBe(14 * 86400000);
    const site = await http
      .post('/sites')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ organizationId: orgId, name: 'One Site' });
    expect(site.status).toBe(201);
    const secondSite = await http
      .post('/sites')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ organizationId: orgId, name: 'Too Many Sites' });
    expect(secondSite.status).toBe(403);
    expect(secondSite.body.code).toBe('PLAN_LIMIT_REACHED');
    const siteList = await controller('/sites');
    expect(siteList.status).toBe(200);
    const proof = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');
    const bad = await http
      .post(`/billing/invoices/${first.body.invoiceId}/proof`)
      .set('Authorization', `Bearer ${controllerToken}`)
      .field('method', 'BANK_TRANSFER')
      .field('claimedAmount', '30000')
      .field('currency', 'TZS')
      .field('reference', 'TX-1')
      .field('claimedPaidAt', new Date().toISOString())
      .attach('proof', Buffer.from('script'), 'evil.pdf');
    expect(bad.status).toBe(400);
    const submit = async (reference: string, claimed: string) =>
      http
        .post(`/billing/invoices/${first.body.invoiceId}/proof`)
        .set('Authorization', `Bearer ${controllerToken}`)
        .field('method', 'BANK_TRANSFER')
        .field('claimedAmount', claimed)
        .field('currency', 'TZS')
        .field('reference', reference)
        .field('claimedPaidAt', new Date().toISOString())
        .attach('proof', proof, {
          filename: 'receipt.pdf',
          contentType: 'application/pdf',
        });
    const p1 = await submit('TX-1', '10000');
    expect(p1.status).toBe(201);
    expect(p1.body.status).toBe('PENDING_REVIEW');
    const queue = await admin('/billing/admin/reviews');
    expect(queue.body.length).toBe(1);
    const review1 = await http
      .post(`/billing/admin/reviews/${p1.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        decision: 'APPROVE',
        verifiedAmount: '10000',
        note: 'Verified bank statement',
      });
    expect(review1.status).toBe(201);
    expect(review1.body.invoicePaid).toBe(false);
    const partial = await controller('/billing/me');
    expect(partial.body.invoices[0].status).toBe('PARTIALLY_PAID');
    expect(
      partial.body.periods.filter((p: { kind: string }) => p.kind === 'PAID'),
    ).toHaveLength(0);
    const p2 = await submit('TX-2', '20000');
    expect(p2.status).toBe(201);
    expect(p2.body.duplicate_warning).toBe(true);
    const review2 = await http
      .post(`/billing/admin/reviews/${p2.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        decision: 'APPROVE',
        verifiedAmount: '20000',
        note: 'Verified second transfer',
      });
    expect(review2.status).toBe(201);
    expect(review2.body.invoicePaid).toBe(true);
    const reviewAgain = await http
      .post(`/billing/admin/reviews/${p2.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'APPROVE', verifiedAmount: '20000', note: 'Retry' });
    expect(reviewAgain.body.alreadyReviewed).toBe(true);
    const paid = await controller('/billing/me');
    expect(paid.body.invoices[0].status).toBe('PAID');
    const history = await controller('/billing/history/invoices').query({
      status: 'PAID',
      search: first.body.invoiceNumber,
      pageSize: 1,
    });
    expect(history.status).toBe(200);
    expect(history.body.total).toBe(1);
    expect(history.body.items[0].id).toBe(first.body.invoiceId);
    expect(
      paid.body.periods.filter((p: { kind: string }) => p.kind === 'PAID'),
    ).toHaveLength(1);
    expect(
      new Date(
        paid.body.periods.find((p: { kind: string }) => p.kind === 'PAID')
          .starts_at,
      ).getTime(),
    ).toBe(new Date(trial.body.trialEndsAt).getTime());
    const stats = await admin('/billing/admin/stats');
    expect(stats.status).toBe(200);
    const dashboard = await admin('/dashboard/admin').query({
      preset: '7d',
      timezone: 'Africa/Dar_es_Salaam',
    });
    if (dashboard.status !== 200)
      throw new Error(JSON.stringify(dashboard.body));
    expect(dashboard.body.snapshot.organizations).toBe(1);
    expect(dashboard.body.billing.money[0].collected).toBe('30000.0000');
    const scopedDashboard = await admin('/dashboard/admin').query({
      organizationId: orgId,
      currency: 'TZS',
      preset: '7d',
    });
    expect(scopedDashboard.status).toBe(200);
    expect(scopedDashboard.body.customers.organizations.total).toBe(1);
    expect(
      scopedDashboard.body.billing.money.every(
        (row: { currency: string }) => row.currency === 'TZS',
      ),
    ).toBe(true);
    expect((await controller('/dashboard/admin')).status).toBe(403);
    expect(stats.body.money[0].collected).toBe('30000.0000');
    const audit = await admin('/billing/admin/audit');
    expect(
      audit.body.items.some(
        (a: { action: string }) => a.action === 'PAYMENT_APPROVED',
      ),
    ).toBe(true);
    const activity = await controller('/billing/activity');
    expect(activity.status).toBe(200);
    expect(
      activity.body.items.some(
        (item: { kind: string }) => item.kind === 'PAYMENT_APPROVED',
      ),
    ).toBe(true);
    const proofGet = await http
      .get(`/billing/submissions/${p1.body.id}/proof`)
      .set('Authorization', `Bearer ${controllerToken}`);
    expect(proofGet.status).toBe(200);
    const otherOrg = await http
      .post('/organizations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Other Billing Customer' });
    await db.getRepository(User).save({
      name: 'Other Controller',
      email: 'other-billing-controller@example.test',
      password: await bcrypt.hash('Other-Controller-123', 12),
      role: UserRole.CONTROLLER,
      isActive: true,
      isActivated: true,
      organizationId: otherOrg.body.id,
      tokenVersion: 0,
    });
    const otherLogin = await http.post('/auth/login').send({
      email: 'other-billing-controller@example.test',
      password: 'Other-Controller-123',
    });
    expect(otherLogin.status).toBe(201);
    expect(
      (
        await http
          .get(`/billing/submissions/${p1.body.id}/proof`)
          .set('Authorization', `Bearer ${otherLogin.body.accessToken}`)
      ).status,
    ).toBe(403);
    expect(
      (
        await http
          .get(`/billing/invoices/${first.body.invoiceId}`)
          .set('Authorization', `Bearer ${otherLogin.body.accessToken}`)
      ).status,
    ).toBe(403);
    expect(
      (
        await http
          .get('/sites')
          .set('Authorization', `Bearer ${otherLogin.body.accessToken}`)
      ).body.code,
    ).toBe('SUBSCRIPTION_REQUIRED');
    expect(
      (
        await http
          .get('/billing/me')
          .set('Authorization', `Bearer ${otherLogin.body.accessToken}`)
      ).status,
    ).toBe(200);
    const otherTrial = await http
      .post('/subscriptions/select')
      .set('Authorization', `Bearer ${otherLogin.body.accessToken}`)
      .send({
        planCode: 'STARTER',
        billingCycle: 'MONTHLY',
        idempotencyKey: 'other-trial',
      });
    expect(otherTrial.status).toBe(201);
    const otherSite = await http
      .post('/sites')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ organizationId: otherOrg.body.id, name: 'Other Site' });
    expect(otherSite.status).toBe(201);
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
    expect(otherEquipment.status).toBe(201);
    const device = await http
      .post('/devices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        organizationId: otherOrg.body.id,
        siteId: otherSite.body.id,
        equipmentId: otherEquipment.body.id,
        name: 'Other Monitor',
        deviceIdentifier: 'other-monitor',
      });
    expect(device.status).toBe(201);
    await db.query(
      "UPDATE organization_subscriptions SET trial_ends_at=now()+interval '2 days 23 hours' WHERE organization_id=$1",
      [otherOrg.body.id],
    );
    await app.get(BillingRemindersService).run();
    await app.get(BillingRemindersService).run();
    expect(
      (
        await db.query(
          "SELECT count(*)::int count FROM billing_reminders WHERE organization_id=$1 AND kind='TRIAL' AND window_days=3",
          [otherOrg.body.id],
        )
      )[0].count,
    ).toBe(1);
    await db.query(
      "UPDATE organization_subscriptions SET trial_ends_at=now()-interval '1 day' WHERE organization_id=$1",
      [otherOrg.body.id],
    );
    const expired = await http
      .get('/sites')
      .set('Authorization', `Bearer ${otherLogin.body.accessToken}`);
    expect(expired.status).toBe(403);
    expect(expired.body.code).toBe('SUBSCRIPTION_EXPIRED');
    expect(
      (
        await http
          .get('/billing/me')
          .set('Authorization', `Bearer ${otherLogin.body.accessToken}`)
      ).status,
    ).toBe(200);
    expect(
      (
        await http
          .post('/sensors/status')
          .set('Authorization', `ApiKey ${device.body.apiKey}`)
          .send({ status: 'ON', eventId: 'post-expiry-observation' })
      ).status,
    ).toBe(201);
  });
});
