import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CrmActivityType,
  CrmCasePriority,
  CrmCaseStatus,
  CrmLeadStatus,
  CrmOpportunityStage,
  CrmTaskPriority,
  CrmTaskStatus,
} from '@prisma/client';

class BaseCrmListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  keyword?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

export class ListCrmLeadsQueryDto extends BaseCrmListQueryDto {
  @IsOptional()
  @IsEnum(CrmLeadStatus)
  status?: CrmLeadStatus;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  ownerUserId?: string;
}

export class ListCrmOpportunitiesQueryDto extends BaseCrmListQueryDto {
  @IsOptional()
  @IsEnum(CrmOpportunityStage)
  stage?: CrmOpportunityStage;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  ownerUserId?: string;
}

export class ListCrmTasksQueryDto extends BaseCrmListQueryDto {
  @IsOptional()
  @IsEnum(CrmTaskStatus)
  status?: CrmTaskStatus;

  @IsOptional()
  @IsEnum(CrmTaskPriority)
  priority?: CrmTaskPriority;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  assigneeUserId?: string;
}

export class ListCrmActivitiesQueryDto extends BaseCrmListQueryDto {
  @IsOptional()
  @IsEnum(CrmActivityType)
  type?: CrmActivityType;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  leadId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  opportunityId?: string;
}

export class ListCrmCasesQueryDto extends BaseCrmListQueryDto {
  @IsOptional()
  @IsEnum(CrmCaseStatus)
  status?: CrmCaseStatus;

  @IsOptional()
  @IsEnum(CrmCasePriority)
  priority?: CrmCasePriority;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  ownerUserId?: string;
}

export class ListCrmCustomersQueryDto extends BaseCrmListQueryDto {}
