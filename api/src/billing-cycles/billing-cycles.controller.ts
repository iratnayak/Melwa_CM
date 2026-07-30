import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request.type';
import { CreateBillingCycleDto } from './dto/create-billing-cycle.dto';
import { UpdateBillingCycleDto } from './dto/update-billing-cycle.dto';
import { ListBillingCyclesQueryDto } from './dto/list-billing-cycles-query.dto';
import { BillingCyclesService } from './billing-cycles.service';
import { CycleActionDto } from './dto/cycle-action.dto';

@Controller('billing-cycles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'officer', 'viewer')
export class BillingCyclesController {
  constructor(private readonly billingCyclesService: BillingCyclesService) {}

  @Post()
  @Roles('admin')
  create(@Req() req: AuthenticatedRequest, @Body() body: CreateBillingCycleDto) {
    return this.billingCyclesService.create(body, req.user.id);
  }

  @Get()
  list(@Query() query: ListBillingCyclesQueryDto) {
    return this.billingCyclesService.list({
      q: query.q,
      status: query.status,
      startDateFrom: query.startDateFrom,
      startDateTo: query.startDateTo,
      skip: query.skip,
      take: query.take,
    });
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.billingCyclesService.get(id);
  }

  @Patch(':id')
  @Roles('admin')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateBillingCycleDto,
  ) {
    return this.billingCyclesService.update(id, body, req.user.id);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Req() req: AuthenticatedRequest, @Param('id', ParseIntPipe) id: number) {
    return this.billingCyclesService.remove(id, req.user.id);
  }

  @Post(':id/settle')
  @Roles('admin')
  settle(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CycleActionDto,
  ) {
    return this.billingCyclesService.settle(id, req.user.id, body.reason);
  }

  @Post(':id/reopen')
  @Roles('admin')
  reopen(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CycleActionDto,
  ) {
    return this.billingCyclesService.reopen(id, req.user.id, body.reason);
  }
}
