import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { AdminModule } from './admin/admin.module';
import { DepartmentsModule } from './departments/departments.module';
import { EmployeesModule } from './employees/employees.module';
import { BillingCyclesModule } from './billing-cycles/billing-cycles.module';
import { CreditTransactionsModule } from './credit-transactions/credit-transactions.module';
import { PaymentsModule } from './payments/payments.module';
import { BalancesModule } from './balances/balances.module';
import { LedgerReportsModule } from './reports/ledger-reports.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    UsersModule,
    AuthModule,
    AdminModule,
    DepartmentsModule,
    EmployeesModule,
    BillingCyclesModule,
    CreditTransactionsModule,
    PaymentsModule,
    BalancesModule,
    LedgerReportsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
