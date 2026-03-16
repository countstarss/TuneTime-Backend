import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { CrmOpportunityStage } from '@prisma/client';

export class CreateCrmOpportunityDto {
  @IsString()
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  leadId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  guardianProfileId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  studentProfileId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  teacherProfileId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  subjectId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  bookingId?: string;

  @IsOptional()
  @IsEnum(CrmOpportunityStage)
  stage?: CrmOpportunityStage;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  ownerUserId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  estimatedValue?: number;

  @IsOptional()
  @IsDateString()
  expectedBookingAt?: string;

  @IsOptional()
  @IsDateString()
  nextFollowUpAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  lossReason?: string;
}

export class UpdateCrmOpportunityDto extends PartialType(CreateCrmOpportunityDto) {}
