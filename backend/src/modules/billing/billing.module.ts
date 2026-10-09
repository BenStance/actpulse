import { Global, Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { EntitlementService } from './entitlement.service';
import {
  BillingController,
  SubscriptionsController,
} from './billing.controller';
import { BillingRemindersService } from './reminders.service';
import { AuditTrailService } from './audit-trail.service';

@Global()
@Module({
  providers: [
    BillingService,
    EntitlementService,
    BillingRemindersService,
    AuditTrailService,
  ],
  controllers: [BillingController, SubscriptionsController],
  exports: [BillingService, EntitlementService, AuditTrailService],
})
export class BillingModule {}
