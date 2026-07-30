import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { BillingCycleStatus } from '../billing-cycle.types';

export class UpdateBillingCycleDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  cycleCode?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsIn(['draft', 'open', 'closed'] satisfies BillingCycleStatus[])
  status?: BillingCycleStatus;
}
