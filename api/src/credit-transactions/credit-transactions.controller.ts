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
import { CreateCreditTransactionDto } from './dto/create-credit-transaction.dto';
import { UpdateCreditTransactionDto } from './dto/update-credit-transaction.dto';
import { ListCreditTransactionsQueryDto } from './dto/list-credit-transactions-query.dto';
import { CreditTransactionsService } from './credit-transactions.service';

@Controller('credit-transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'officer', 'viewer')
export class CreditTransactionsController {
  constructor(
    private readonly creditTransactionsService: CreditTransactionsService,
  ) {}

  @Post()
  @Roles('admin')
  create(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateCreditTransactionDto,
  ) {
    return this.creditTransactionsService.create(body, req.user.id);
  }

  @Get()
  list(@Query() query: ListCreditTransactionsQueryDto) {
    return this.creditTransactionsService.list({
      q: query.q,
      employeeId: query.employeeId,
      billingCycleId: query.billingCycleId,
      transactionType: query.transactionType,
      fromDate: query.fromDate,
      toDate: query.toDate,
      skip: query.skip,
      take: query.take,
    });
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.creditTransactionsService.get(id);
  }

  @Patch(':id')
  @Roles('admin')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCreditTransactionDto,
  ) {
    return this.creditTransactionsService.update(id, body, req.user.id);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Req() req: AuthenticatedRequest, @Param('id', ParseIntPipe) id: number) {
    return this.creditTransactionsService.remove(id, req.user.id);
  }
}
