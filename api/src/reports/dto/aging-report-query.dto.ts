import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class AgingReportQueryDto {
  @IsDateString()
  asOfDate!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  departmentId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId?: number;

  @IsOptional()
  @IsIn(['json', 'csv'])
  format?: 'json' | 'csv';
}

