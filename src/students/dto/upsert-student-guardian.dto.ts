import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GuardianRelation } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class UpsertStudentGuardianDto {
  @ApiProperty({
    description: '家长档案 ID。',
    example: 'cmc123guardian001',
  })
  @IsString()
  @Length(8, 36)
  guardianProfileId!: string;

  @ApiProperty({
    description: '家长与学生关系。',
    enum: GuardianRelation,
    example: GuardianRelation.MOTHER,
  })
  @IsEnum(GuardianRelation)
  relation!: GuardianRelation;

  @ApiPropertyOptional({
    description: '是否设为主要联系人。',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({
    description: '是否允许代为预约。',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  canBook?: boolean;

  @ApiPropertyOptional({
    description: '是否允许查看课程记录。',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  canViewRecords?: boolean;
}
