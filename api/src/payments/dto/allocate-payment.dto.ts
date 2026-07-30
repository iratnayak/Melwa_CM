import { IsBoolean, IsOptional } from 'class-validator';

export class AllocatePaymentDto {
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
