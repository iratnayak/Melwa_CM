import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { LedgerReportsController } from './ledger-reports.controller';
import { LedgerReportsService } from './ledger-reports.service';

@Module({
  imports: [AuditModule],
  controllers: [LedgerReportsController],
  providers: [LedgerReportsService],
  exports: [LedgerReportsService],
})
export class LedgerReportsModule {}

