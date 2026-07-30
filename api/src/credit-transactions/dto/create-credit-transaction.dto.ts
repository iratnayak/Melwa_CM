import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import type { CreditTransactionType } from '../credit-transaction.types';

export class CreateCreditTransactionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  billingCycleId!: number;

  @IsDateString()
  txnDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsIn(['purchase', 'adjustment', 'reversal'] satisfies CreditTransactionType[])
  transactionType?: CreditTransactionType;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sourceReference?: string;
}
