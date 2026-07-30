import { Module } from '@nestjs/common';
import { CreditTransactionsController } from './credit-transactions.controller';
import { CreditTransactionsService } from './credit-transactions.service';
import { AuditModule } from '../audit/audit.module';
import { BalancesModule } from '../balances/balances.module';

@Module({
  imports: [AuditModule, BalancesModule],
  controllers: [CreditTransactionsController],
  providers: [CreditTransactionsService],
  exports: [CreditTransactionsService],
})
export class CreditTransactionsModule {}
