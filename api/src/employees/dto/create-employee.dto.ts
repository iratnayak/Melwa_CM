import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  employeeCode!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  departmentId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}
