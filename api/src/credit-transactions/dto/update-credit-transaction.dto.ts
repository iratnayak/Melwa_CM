import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import type { CreditTransactionType } from '../credit-transaction.types';

export class UpdateCreditTransactionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  billingCycleId?: number;

  @IsOptional()
  @IsDateString()
  txnDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsIn(['purchase', 'adjustment', 'reversal'] satisfies CreditTransactionType[])
  transactionType?: CreditTransactionType;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceReference?: string;
}
