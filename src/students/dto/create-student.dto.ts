import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GradeLevel, GuardianRelation } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CreateStudentGuardianBindingDto {
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
    description: '是否允许该家长代为预约。',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  canBook?: boolean;

  @ApiPropertyOptional({
    description: '是否允许该家长查看课程记录。',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  canViewRecords?: boolean;
}

export class CreateStudentDto {
  @ApiPropertyOptional({
    description: '学生关联的用户 ID。对于没有独立账号的孩子可不传。',
    example: 'cmc123user-student001',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @Length(8, 36)
  userId?: string;

  @ApiProperty({
    description: '学生姓名。',
    example: '小王',
  })
  @IsString()
  @Length(1, 64)
  displayName!: string;

  @ApiProperty({
    description: '年级阶段。',
    enum: GradeLevel,
    example: GradeLevel.PRIMARY,
  })
  @IsEnum(GradeLevel)
  gradeLevel!: GradeLevel;

  @ApiPropertyOptional({
    description: '出生日期。',
    example: '2017-09-01',
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({
    description: '学校名称。',
    example: '天津市实验小学',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  schoolName?: string;

  @ApiPropertyOptional({
    description: '学习目标。',
    example: '希望一年内完成钢琴启蒙并能够独立识谱。',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  learningGoals?: string;

  @ApiPropertyOptional({
    description: '特殊说明，例如注意力、身体情况、接送安排等。',
    example: '上课时需要家长陪同，注意力持续时间约 30 分钟。',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  specialNeeds?: string;

  @ApiPropertyOptional({
    description: '时区，默认 Asia/Shanghai。',
    example: 'Asia/Shanghai',
    default: 'Asia/Shanghai',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({
    description: '创建学生时同步绑定的家长列表。',
    type: CreateStudentGuardianBindingDto,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStudentGuardianBindingDto)
  guardians?: CreateStudentGuardianBindingDto[];
}
