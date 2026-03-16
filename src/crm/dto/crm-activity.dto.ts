import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CrmActivityType } from '@prisma/client';

export class CreateCrmActivityDto {
  @IsEnum(CrmActivityType)
  type!: CrmActivityType;

  @IsString()
  @MaxLength(1000)
  content!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  leadId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  opportunityId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  guardianProfileId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  bookingId?: string;

  @IsOptional()
  @IsDateString()
  happenedAt?: string;
}
