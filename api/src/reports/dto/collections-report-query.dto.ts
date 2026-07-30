import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class CollectionsReportQueryDto {
  @IsDateString()
  fromDate!: string;

  @IsDateString()
  toDate!: string;

  @IsOptional()
  method?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  receivedByUserId?: number;

  @IsOptional()
  @IsIn(['json', 'csv'])
  format?: 'json' | 'csv';
}

