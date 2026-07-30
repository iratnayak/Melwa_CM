import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';
import type { UserRole } from '../user.types';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsIn(['admin', 'officer', 'viewer'] satisfies UserRole[])
  role?: UserRole;
}

