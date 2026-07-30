import { IsDateString, IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type { BillingCycleStatus } from '../billing-cycle.types';

export class CreateBillingCycleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  cycleCode!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsDateString()
  dueDate!: string;

  @IsIn(['draft', 'open', 'closed'] satisfies BillingCycleStatus[])
  status!: BillingCycleStatus;
}
