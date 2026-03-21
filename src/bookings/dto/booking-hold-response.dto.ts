import { ApiProperty } from '@nestjs/swagger';

export class BookingHoldResponseDto {
  @ApiProperty({ description: '占位 ID。', example: 'hold_001' })
  id!: string;

  @ApiProperty({ description: '老师档案 ID。', example: 'teacher_001' })
  teacherProfileId!: string;

  @ApiProperty({ description: '学生档案 ID。', example: 'student_001' })
  studentProfileId!: string;

  @ApiProperty({
    description: '家长档案 ID。',
    example: 'guardian_001',
    nullable: true,
    required: false,
  })
  guardianProfileId!: string | null;

  @ApiProperty({ description: '科目 ID。', example: 'subject_001' })
  subjectId!: string;

  @ApiProperty({ description: '服务地址 ID。', example: 'address_001' })
  serviceAddressId!: string;

  @ApiProperty({
    description: '开始时间。',
    example: '2026-03-28T10:00:00.000Z',
  })
  startAt!: Date;

  @ApiProperty({
    description: '结束时间。',
    example: '2026-03-28T11:00:00.000Z',
  })
  endAt!: Date;

  @ApiProperty({ description: '状态。', example: 'ACTIVE' })
  status!: string;

  @ApiProperty({
    description: '过期时间。',
    example: '2026-03-28T10:05:00.000Z',
  })
  expiresAt!: Date;

  @ApiProperty({ description: '时区。', example: 'Asia/Shanghai' })
  timezone!: string;
}
