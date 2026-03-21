import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateBookingHoldDto {
  @ApiProperty({ description: '老师档案 ID。', example: 'teacher_001' })
  @IsString()
  @Length(8, 36)
  teacherProfileId!: string;

  @ApiProperty({ description: '学生档案 ID。', example: 'student_001' })
  @IsString()
  @Length(8, 36)
  studentProfileId!: string;

  @ApiProperty({ description: '科目 ID。', example: 'subject_001' })
  @IsString()
  @Length(8, 36)
  subjectId!: string;

  @ApiProperty({ description: '服务地址 ID。', example: 'address_001' })
  @IsString()
  @Length(8, 36)
  serviceAddressId!: string;

  @ApiProperty({
    description: '预约开始时间。',
    example: '2026-03-28T10:00:00.000Z',
  })
  @IsDateString()
  startAt!: string;

  @ApiProperty({
    description: '预约结束时间。',
    example: '2026-03-28T11:00:00.000Z',
  })
  @IsDateString()
  endAt!: string;

  @ApiPropertyOptional({ description: '时区。', example: 'Asia/Shanghai' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({
    description: '预约备注。',
    example: '孩子是零基础，希望老师节奏慢一点。',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
