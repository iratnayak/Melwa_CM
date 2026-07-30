import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  employeeCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  fullName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  departmentId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}
