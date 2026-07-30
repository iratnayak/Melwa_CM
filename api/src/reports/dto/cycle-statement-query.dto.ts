import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class CycleStatementQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  billingCycleId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  departmentId?: number;

  @IsOptional()
  @IsIn(['true', 'false'])
  isOverdue?: 'true' | 'false';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  take?: number;

  @IsOptional()
  @IsIn(['json', 'csv'])
  format?: 'json' | 'csv';
}

