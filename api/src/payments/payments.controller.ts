import {
  Body,
  Controller,
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
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { AllocatePaymentDto } from './dto/allocate-payment.dto';
import { ReversePaymentDto } from './dto/reverse-payment.dto';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'officer', 'viewer')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @Roles('admin')
  create(@Req() req: AuthenticatedRequest, @Body() body: CreatePaymentDto) {
    return this.paymentsService.create(body, req.user.id);
  }

  @Get()
  list(@Query() query: ListPaymentsQueryDto) {
    return this.paymentsService.list({
      q: query.q,
      employeeId: query.employeeId,
      billingCycleId: query.billingCycleId,
      status: query.status,
      fromDate: query.fromDate,
      toDate: query.toDate,
      skip: query.skip,
      take: query.take,
    });
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.paymentsService.get(id);
  }

  @Patch(':id')
  @Roles('admin')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdatePaymentDto,
  ) {
    return this.paymentsService.update(id, body, req.user.id);
  }

  @Post(':id/allocate')
  @Roles('admin')
  allocate(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AllocatePaymentDto,
  ) {
    return this.paymentsService.allocate(id, req.user.id, body.dryRun);
  }

  @Post(':id/reverse')
  @Roles('admin')
  reverse(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ReversePaymentDto,
  ) {
    return this.paymentsService.reverse(id, req.user.id, body.reason);
  }
}
