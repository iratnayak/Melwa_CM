import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class RecalculateBalancesDto {
  @IsOptional()
  @IsIn(['employee_cycle', 'employee_all_cycles', 'cycle_all_employees'])
  mode?: 'employee_cycle' | 'employee_all_cycles' | 'cycle_all_employees';

  @ValidateIf((o: RecalculateBalancesDto) =>
    (o.mode ?? 'employee_cycle') !== 'cycle_all_employees',
  )
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId?: number;

  @ValidateIf(
    (o: RecalculateBalancesDto) =>
      (o.mode ?? 'employee_cycle') === 'employee_cycle' ||
      (o.mode ?? 'employee_cycle') === 'cycle_all_employees',
  )
  @Type(() => Number)
  @IsInt()
  @Min(1)
  billingCycleId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

