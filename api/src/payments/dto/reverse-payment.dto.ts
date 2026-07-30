import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReversePaymentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason?: string;
}
