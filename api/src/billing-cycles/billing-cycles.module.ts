import { Module } from '@nestjs/common';
import { BillingCyclesController } from './billing-cycles.controller';
import { BillingCyclesService } from './billing-cycles.service';
import { AuditModule } from '../audit/audit.module';
import { BalancesModule } from '../balances/balances.module';

@Module({
  imports: [AuditModule, BalancesModule],
  controllers: [BillingCyclesController],
  providers: [BillingCyclesService],
  exports: [BillingCyclesService],
})
export class BillingCyclesModule {}
