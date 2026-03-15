import { ApiProperty } from '@nestjs/swagger';

export class TeacherReviewBookingSummaryDto {
  @ApiProperty({ description: '预约 ID。', example: 'cmc123booking001' })
  id!: string;

  @ApiProperty({ description: '预约单号。', example: 'BK202603150001' })
  bookingNo!: string;

  @ApiProperty({ description: '预约状态。', example: 'COMPLETED' })
  status!: string;
}

export class TeacherReviewTeacherSummaryDto {
  @ApiProperty({ description: '老师档案 ID。', example: 'cmc123teacher001' })
  id!: string;

  @ApiProperty({
    description: '老师用户 ID。',
    example: 'cmc123user-teacher001',
  })
  userId!: string;

  @ApiProperty({ description: '老师展示名。', example: '李老师' })
  displayName!: string;
}

export class TeacherReviewStudentSummaryDto {
  @ApiProperty({ description: '学生档案 ID。', example: 'cmc123student001' })
  id!: string;

  @ApiProperty({
    description: '学生用户 ID。',
    example: 'cmc123user-student001',
    nullable: true,
    required: false,
  })
  userId!: string | null;

  @ApiProperty({ description: '学生昵称。', example: '小宇' })
  displayName!: string;
}

export class TeacherReviewGuardianSummaryDto {
  @ApiProperty({
    description: '家长档案 ID。',
    example: 'cmc123guardian001',
    nullable: true,
    required: false,
  })
  id!: string | null;

  @ApiProperty({
    description: '家长用户 ID。',
    example: 'cmc123user-guardian001',
    nullable: true,
    required: false,
  })
  userId!: string | null;

  @ApiProperty({
    description: '家长展示名。',
    example: '王女士',
    nullable: true,
    required: false,
  })
  displayName!: string | null;
}

export class TeacherReviewResponseDto {
  @ApiProperty({ description: '评价 ID。', example: 'cmc123review001' })
  id!: string;

  @ApiProperty({ description: '预约 ID。', example: 'cmc123booking001' })
  bookingId!: string;

  @ApiProperty({ description: '老师档案 ID。', example: 'cmc123teacher001' })
  teacherProfileId!: string;

  @ApiProperty({ description: '学生档案 ID。', example: 'cmc123student001' })
  studentProfileId!: string;

  @ApiProperty({
    description: '家长档案 ID。',
    example: 'cmc123guardian001',
    nullable: true,
    required: false,
  })
  guardianProfileId!: string | null;

  @ApiProperty({ description: '总体评分。', example: 5 })
  rating!: number;

  @ApiProperty({
    description: '课程质量评分。',
    example: 5,
    nullable: true,
    required: false,
  })
  lessonQualityRating!: number | null;

  @ApiProperty({
    description: '老师表现评分。',
    example: 4,
    nullable: true,
    required: false,
  })
  teacherPerformanceRating!: number | null;

  @ApiProperty({
    description: '评价内容。',
    example: '老师很有耐心。',
    nullable: true,
    required: false,
  })
  comment!: string | null;

  @ApiProperty({
    description: '改进建议。',
    example: '可以增加节奏训练。',
    nullable: true,
    required: false,
  })
  improvementNotes!: string | null;

  @ApiProperty({
    description: '评价标签。',
    example: ['耐心', '专业'],
    type: String,
    isArray: true,
  })
  tags!: string[];

  @ApiProperty({
    description: '预约摘要。',
    type: TeacherReviewBookingSummaryDto,
  })
  booking!: TeacherReviewBookingSummaryDto;

  @ApiProperty({
    description: '老师摘要。',
    type: TeacherReviewTeacherSummaryDto,
  })
  teacher!: TeacherReviewTeacherSummaryDto;

  @ApiProperty({
    description: '学生摘要。',
    type: TeacherReviewStudentSummaryDto,
  })
  student!: TeacherReviewStudentSummaryDto;

  @ApiProperty({
    description: '家长摘要。',
    type: TeacherReviewGuardianSummaryDto,
  })
  guardian!: TeacherReviewGuardianSummaryDto;

  @ApiProperty({
    description: '创建时间。',
    example: '2026-03-20T12:30:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: '更新时间。',
    example: '2026-03-20T12:35:00.000Z',
  })
  updatedAt!: Date;
}

export class TeacherReviewListResponseDto {
  @ApiProperty({
    description: '评价列表。',
    type: TeacherReviewResponseDto,
    isArray: true,
  })
  items!: TeacherReviewResponseDto[];

  @ApiProperty({ description: '当前页码。', example: 1 })
  page!: number;

  @ApiProperty({ description: '每页数量。', example: 20 })
  pageSize!: number;

  @ApiProperty({ description: '总记录数。', example: 6 })
  total!: number;

  @ApiProperty({ description: '总页数。', example: 1 })
  totalPages!: number;
}

export class TeacherReviewSummaryResponseDto {
  @ApiProperty({ description: '老师档案 ID。', example: 'cmc123teacher001' })
  teacherProfileId!: string;

  @ApiProperty({ description: '老师展示名。', example: '李老师' })
  displayName!: string;

  @ApiProperty({ description: '总体平均分。', example: 4.8 })
  ratingAvg!: number;

  @ApiProperty({ description: '评价数量。', example: 10 })
  ratingCount!: number;

  @ApiProperty({ description: '课程质量平均分。', example: 4.9 })
  lessonQualityRatingAvg!: number;

  @ApiProperty({ description: '老师表现平均分。', example: 4.7 })
  teacherPerformanceRatingAvg!: number;
}

export class DeleteTeacherReviewResponseDto {
  @ApiProperty({ description: '是否删除成功。', example: true })
  success!: boolean;

  @ApiProperty({ description: '返回说明。', example: '评价已删除' })
  message!: string;
}
