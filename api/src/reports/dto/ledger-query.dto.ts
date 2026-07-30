import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class LedgerQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId!: number;

  @IsDateString()
  fromDate!: string;

  @IsDateString()
  toDate!: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  includeOpening?: 'true' | 'false';

  @IsOptional()
  @IsIn(['json', 'csv'])
  format?: 'json' | 'csv';
}

