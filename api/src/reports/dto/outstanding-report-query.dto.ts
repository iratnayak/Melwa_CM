import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class OutstandingReportQueryDto {
  @IsOptional()
  @IsDateString()
  asOfDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  departmentId?: number;

  @IsIn(['employee', 'department'])
  groupBy!: 'employee' | 'department';

  @IsOptional()
  @IsIn(['json', 'csv'])
  format?: 'json' | 'csv';
}

