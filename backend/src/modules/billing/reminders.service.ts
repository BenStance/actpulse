import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class BillingRemindersService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private readonly logger = new Logger(BillingRemindersService.name);
  constructor(private readonly db: DataSource) {}
  onModuleInit() {
    void this.run().catch((error) => this.logger.error(error));
    this.timer = setInterval(
      () => void this.run().catch((error) => this.logger.error(error)),
      60 * 60 * 1000,
    );
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async run() {
    const targets: unknown = await this.db
      .query(`SELECT s.organization_id,'TRIAL' kind,s.organization_id entity_id,s.trial_ends_at target_at FROM organization_subscriptions s
      UNION ALL SELECT p.organization_id,'PAID',p.id,p.ends_at FROM subscription_periods p WHERE p.kind='PAID'
      UNION ALL SELECT i.organization_id,'INVOICE',i.id,i.due_at FROM invoices i WHERE i.status IN ('OPEN','PARTIALLY_PAID')`);
    for (const target of targets as Array<{
      organization_id: string;
      kind: string;
      entity_id: string;
      target_at: Date;
    }>) {
      const remaining = new Date(target.target_at).getTime() - Date.now();
      const window =
        remaining <= 0 && remaining > -(24 * 60 * 60 * 1000)
          ? 0
          : remaining > 0 &&
              remaining <= 3 * 86400000 &&
              remaining > 2 * 86400000
            ? 3
            : remaining > 3 * 86400000 &&
                remaining <= 7 * 86400000 &&
                remaining > 6 * 86400000
              ? 7
              : null;
      if (window === null) continue;
      const title =
        target.kind === 'INVOICE'
          ? 'Invoice due reminder'
          : `${target.kind === 'TRIAL' ? 'Trial' : 'Paid access'} expiry reminder`;
      const message =
        window === 0
          ? `${title}: due now. Review your subscription and billing.`
          : `${title}: due in about ${window} days. Review your subscription and billing.`;
      await this.db.transaction(async (manager) => {
        const inserted: unknown = await manager.query(
          `INSERT INTO billing_reminders(organization_id,kind,entity_id,window_days) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING id`,
          [target.organization_id, target.kind, target.entity_id, window],
        );
        if (!(inserted as Array<unknown>).length) return;
        await manager.query(
          `INSERT INTO notifications(user_id,title,message) SELECT u.id,$2,$3 FROM users u LEFT JOIN notification_preferences p ON p.user_id=u.id
          WHERE u.organization_id=$1 AND u.role='Controller' AND u.is_active=true AND coalesce(p.in_app,true)=true`,
          [target.organization_id, title, message],
        );
      });
    }
  }
}
