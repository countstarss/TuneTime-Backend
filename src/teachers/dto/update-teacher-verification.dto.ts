import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TeacherVerificationStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTeacherVerificationDto {
  @ApiProperty({
    description: '新的审核状态。',
    enum: TeacherVerificationStatus,
    example: TeacherVerificationStatus.APPROVED,
  })
  @IsEnum(TeacherVerificationStatus)
  verificationStatus!: TeacherVerificationStatus;

  @ApiPropertyOptional({
    description: '面试备注，通常用于补充审核说明。',
    example: '资质齐全，通过审核。',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  interviewNotes?: string;
}
