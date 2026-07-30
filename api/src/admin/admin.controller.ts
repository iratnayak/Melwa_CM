import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuditService } from '../audit/audit.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly auditService: AuditService) {}

  @Get('ping')
  @Roles('admin')
  ping() {
    return { ok: true };
  }

  @Get('audit-logs')
  @Roles('admin')
  auditLogs(@Query() query: ListAuditLogsQueryDto) {
    return this.auditService.listAuditLogs({
      entityName: query.entityName,
      skip: query.skip,
      take: query.take,
    });
  }
}

