import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request.type';
import { LedgerReportsService } from './ledger-reports.service';
import { LedgerQueryDto } from './dto/ledger-query.dto';
import { CycleStatementQueryDto } from './dto/cycle-statement-query.dto';
import { AgingReportQueryDto } from './dto/aging-report-query.dto';
import { CollectionsReportQueryDto } from './dto/collections-report-query.dto';
import { OutstandingReportQueryDto } from './dto/outstanding-report-query.dto';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'officer', 'viewer')
export class LedgerReportsController {
  constructor(private readonly reportsService: LedgerReportsService) {}

  private sendCsv(
    res: Response,
    payload: { csv: string; filename: string },
  ): string {
    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.setHeader('content-disposition', `attachment; filename="${payload.filename}"`);
    return payload.csv;
  }

  @Get('ledger')
  async ledger(
    @Req() req: AuthenticatedRequest,
    @Query() query: LedgerQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.reportsService.ledger({
      employeeId: query.employeeId,
      fromDate: query.fromDate,
      toDate: query.toDate,
      includeOpening: query.includeOpening !== 'false',
      actorUserId: req.user.id,
      format: query.format ?? 'json',
    });
    if (query.format === 'csv') {
      return this.sendCsv(res, result as { csv: string; filename: string });
    }
    return result;
  }

  @Get('cycle-statement')
  async cycleStatement(
    @Req() req: AuthenticatedRequest,
    @Query() query: CycleStatementQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.reportsService.cycleStatement({
      billingCycleId: query.billingCycleId,
      departmentId: query.departmentId,
      isOverdue: query.isOverdue === undefined ? undefined : query.isOverdue === 'true',
      skip: query.skip,
      take: query.take,
      actorUserId: req.user.id,
      format: query.format ?? 'json',
    });
    if (query.format === 'csv') {
      return this.sendCsv(res, result as { csv: string; filename: string });
    }
    return result;
  }

  @Get('aging')
  async aging(
    @Req() req: AuthenticatedRequest,
    @Query() query: AgingReportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.reportsService.aging({
      asOfDate: query.asOfDate,
      departmentId: query.departmentId,
      employeeId: query.employeeId,
      actorUserId: req.user.id,
      format: query.format ?? 'json',
    });
    if (query.format === 'csv') {
      return this.sendCsv(res, result as { csv: string; filename: string });
    }
    return result;
  }

  @Get('collections')
  async collections(
    @Req() req: AuthenticatedRequest,
    @Query() query: CollectionsReportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.reportsService.collections({
      fromDate: query.fromDate,
      toDate: query.toDate,
      method: query.method,
      receivedByUserId: query.receivedByUserId,
      actorUserId: req.user.id,
      format: query.format ?? 'json',
    });
    if (query.format === 'csv') {
      return this.sendCsv(res, result as { csv: string; filename: string });
    }
    return result;
  }

  @Get('outstanding')
  async outstanding(
    @Req() req: AuthenticatedRequest,
    @Query() query: OutstandingReportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.reportsService.outstanding({
      asOfDate: query.asOfDate,
      departmentId: query.departmentId,
      groupBy: query.groupBy,
      actorUserId: req.user.id,
      format: query.format ?? 'json',
    });
    if (query.format === 'csv') {
      return this.sendCsv(res, result as { csv: string; filename: string });
    }
    return result;
  }
}

