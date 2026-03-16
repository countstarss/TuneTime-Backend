import { PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CrmTaskPriority, CrmTaskStatus } from '@prisma/client';

export class CreateCrmTaskDto {
  @IsString()
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(CrmTaskStatus)
  status?: CrmTaskStatus;

  @IsOptional()
  @IsEnum(CrmTaskPriority)
  priority?: CrmTaskPriority;

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
  @IsString()
  @MaxLength(64)
  assigneeUserId?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;
}

export class UpdateCrmTaskDto extends PartialType(CreateCrmTaskDto) {}
