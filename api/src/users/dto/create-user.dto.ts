import { IsEmail, IsIn, IsNotEmpty, IsString, MinLength } from 'class-validator';
import type { UserRole } from '../user.types';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsIn(['admin', 'officer', 'viewer'] satisfies UserRole[])
  role!: UserRole;
}

