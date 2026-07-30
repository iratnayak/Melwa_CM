import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CycleActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

