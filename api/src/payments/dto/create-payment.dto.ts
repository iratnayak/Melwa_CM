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

export class CreatePaymentDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  billingCycleId?: number;

  @IsDateString()
  paymentDate!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  @MaxLength(30)
  method!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceNo?: string;

  @IsOptional()
  @IsIn(['recorded', 'allocated', 'partially_allocated', 'reversed'])
  status?: 'recorded' | 'allocated' | 'partially_allocated' | 'reversed';
}
