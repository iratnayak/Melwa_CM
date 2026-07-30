import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { AuditModule } from '../audit/audit.module';
import { BalancesModule } from '../balances/balances.module';

@Module({
  imports: [AuditModule, BalancesModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
