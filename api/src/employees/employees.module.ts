import { Module } from '@nestjs/common';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { AuditModule } from '../audit/audit.module';
import { BalancesModule } from '../balances/balances.module';

@Module({
  imports: [AuditModule, BalancesModule],
  controllers: [EmployeesController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
