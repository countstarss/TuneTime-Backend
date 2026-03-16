import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CrmCaseCategory, CrmCasePriority, CrmCaseStatus } from '@prisma/client';

export class CreateCrmCaseDto {
  @IsString()
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsEnum(CrmCaseCategory)
  category!: CrmCaseCategory;

  @IsOptional()
  @IsEnum(CrmCaseStatus)
  status?: CrmCaseStatus;

  @IsOptional()
  @IsEnum(CrmCasePriority)
  priority?: CrmCasePriority;

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
  studentProfileId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  teacherProfileId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  bookingId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  ownerUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  resolutionSummary?: string;

  @IsOptional()
  @IsDateString()
  nextActionAt?: string;

  @IsOptional()
  @IsDateString()
  closedAt?: string;
}

export class UpdateCrmCaseDto extends PartialType(CreateCrmCaseDto) {}
