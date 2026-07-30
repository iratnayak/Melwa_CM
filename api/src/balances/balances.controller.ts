import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request.type';
import { BalancesService } from './balances.service';
import { ListBalancesQueryDto } from './dto/list-balances-query.dto';
import { RecalculateBalancesDto } from './dto/recalculate-balances.dto';

@Controller('balances')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'officer', 'viewer')
export class BalancesController {
  constructor(private readonly balancesService: BalancesService) {}

  @Get()
  list(@Query() query: ListBalancesQueryDto) {
    return this.balancesService.list({
      employeeId: query.employeeId,
      billingCycleId: query.billingCycleId,
      isOverdue:
        query.isOverdue === undefined ? undefined : query.isOverdue === 'true',
      skip: query.skip,
      take: query.take,
    });
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.balancesService.get(id);
  }

  @Post('recalculate')
  @Roles('admin')
  recalculate(
    @Req() req: AuthenticatedRequest,
    @Body() body: RecalculateBalancesDto,
  ) {
    return this.balancesService.recalculateWithMode(body, req.user.id);
  }
}

