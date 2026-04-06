import { ApiProperty } from '@nestjs/swagger';

export class LessonBookingSummaryDto {
  @ApiProperty({ description: '预约 ID。', example: 'cmc123booking001' })
  id!: string;

  @ApiProperty({ description: '预约单号。', example: 'BK202603150001' })
  bookingNo!: string;

  @ApiProperty({ description: '预约状态。', example: 'CONFIRMED' })
  status!: string;

  @ApiProperty({
    description: '预约开始时间。',
    example: '2026-03-20T09:00:00.000Z',
  })
  startAt!: Date;

  @ApiProperty({
    description: '预约结束时间。',
    example: '2026-03-20T10:00:00.000Z',
  })
  endAt!: Date;
}

export class LessonTeacherSummaryDto {
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

export class LessonStudentSummaryDto {
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

  @ApiProperty({
    description: '年级。',
    example: 'PRIMARY',
    nullable: true,
    required: false,
  })
  gradeLevel!: string | null;
}

export class LessonEvidenceDto {
  @ApiProperty({ description: '证据 ID。', example: 'evi_001' })
  id!: string;

  @ApiProperty({ description: '证据类型。', example: 'RESULT_PHOTO' })
  type!: string;

  @ApiProperty({
    description: '证据链接。',
    example: 'https://example.com/result-photo.jpg',
  })
  url!: string;

  @ApiProperty({
    description: '证据备注。',
    example: '课堂作品照片',
    nullable: true,
    required: false,
  })
  note!: string | null;

  @ApiProperty({
    description: '上传人用户 ID。',
    example: 'user_001',
  })
  uploadedByUserId!: string;

  @ApiProperty({
    description: '上传时间。',
    example: '2026-04-04T10:00:00.000Z',
  })
  uploadedAt!: Date;
}

export class LessonResponseDto {
  @ApiProperty({ description: '课程 ID。', example: 'cmc123lesson001' })
  id!: string;

  @ApiProperty({ description: '预约 ID。', example: 'cmc123booking001' })
  bookingId!: string;

  @ApiProperty({ description: '老师档案 ID。', example: 'cmc123teacher001' })
  teacherProfileId!: string;

  @ApiProperty({ description: '学生档案 ID。', example: 'cmc123student001' })
  studentProfileId!: string;

  @ApiProperty({ description: '出勤状态。', example: 'SCHEDULED' })
  attendanceStatus!: string;

  @ApiProperty({
    description: '到达确认时间。',
    example: '2026-03-20T08:50:00.000Z',
    nullable: true,
    required: false,
  })
  arrivalConfirmedAt!: Date | null;

  @ApiProperty({
    description: '到达纬度。',
    example: 39.1267,
    nullable: true,
    required: false,
  })
  arrivalLatitude!: number | null;

  @ApiProperty({
    description: '到达经度。',
    example: 117.2059,
    nullable: true,
    required: false,
  })
  arrivalLongitude!: number | null;

  @ApiProperty({
    description: '到达地址。',
    example: '天津市南开区黄河道 100 号',
    nullable: true,
    required: false,
  })
  arrivalAddress!: string | null;

  @ApiProperty({
    description: '到达备注。',
    example: '已到达小区门口，等待家长开门。',
    nullable: true,
    required: false,
  })
  arrivalNote!: string | null;

  @ApiProperty({
    description: '签到时间。',
    example: '2026-03-20T08:58:00.000Z',
    nullable: true,
    required: false,
  })
  checkInAt!: Date | null;

  @ApiProperty({
    description: '签到纬度。',
    example: 39.1267,
    nullable: true,
    required: false,
  })
  checkInLatitude!: number | null;

  @ApiProperty({
    description: '签到经度。',
    example: 117.2059,
    nullable: true,
    required: false,
  })
  checkInLongitude!: number | null;

  @ApiProperty({
    description: '签到地址。',
    example: '天津市南开区黄河道 100 号',
    nullable: true,
    required: false,
  })
  checkInAddress!: string | null;

  @ApiProperty({
    description: '实际上课开始时间。',
    example: '2026-03-20T09:00:00.000Z',
    nullable: true,
    required: false,
  })
  startedAt!: Date | null;

  @ApiProperty({
    description: '实际上课结束时间。',
    example: '2026-03-20T10:00:00.000Z',
    nullable: true,
    required: false,
  })
  endedAt!: Date | null;

  @ApiProperty({
    description: '签退时间。',
    example: '2026-03-20T10:05:00.000Z',
    nullable: true,
    required: false,
  })
  checkOutAt!: Date | null;

  @ApiProperty({
    description: '签退纬度。',
    example: 39.1267,
    nullable: true,
    required: false,
  })
  checkOutLatitude!: number | null;

  @ApiProperty({
    description: '签退经度。',
    example: 117.2059,
    nullable: true,
    required: false,
  })
  checkOutLongitude!: number | null;

  @ApiProperty({
    description: '签退地址。',
    example: '天津市南开区黄河道 100 号',
    nullable: true,
    required: false,
  })
  checkOutAddress!: string | null;

  @ApiProperty({
    description: '老师总结。',
    example: '完成右手五指练习。',
    nullable: true,
    required: false,
  })
  teacherSummary!: string | null;

  @ApiProperty({
    description: '作业。',
    example: '练习《小星星》前 8 小节。',
    nullable: true,
    required: false,
  })
  homework!: string | null;

  @ApiProperty({
    description: '成果视频地址。',
    example: 'https://example.com/outcome-video.mp4',
    nullable: true,
    required: false,
  })
  outcomeVideoUrl!: string | null;

  @ApiProperty({
    description: '反馈提交时间。',
    example: '2026-03-20T12:30:00.000Z',
    nullable: true,
    required: false,
  })
  feedbackSubmittedAt!: Date | null;

  @ApiProperty({
    description: '家长反馈。',
    example: '老师很有耐心。',
    nullable: true,
    required: false,
  })
  guardianFeedback!: string | null;

  @ApiProperty({ description: '预约摘要。', type: LessonBookingSummaryDto })
  booking!: LessonBookingSummaryDto;

  @ApiProperty({ description: '老师摘要。', type: LessonTeacherSummaryDto })
  teacher!: LessonTeacherSummaryDto;

  @ApiProperty({ description: '学生摘要。', type: LessonStudentSummaryDto })
  student!: LessonStudentSummaryDto;

  @ApiProperty({
    description: '课程证据。',
    type: LessonEvidenceDto,
    isArray: true,
  })
  evidences!: LessonEvidenceDto[];

  @ApiProperty({
    description: '创建时间。',
    example: '2026-03-20T08:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: '更新时间。',
    example: '2026-03-20T12:30:00.000Z',
  })
  updatedAt!: Date;
}

export class LessonListResponseDto {
  @ApiProperty({
    description: '课程列表。',
    type: LessonResponseDto,
    isArray: true,
  })
  items!: LessonResponseDto[];

  @ApiProperty({ description: '当前页码。', example: 1 })
  page!: number;

  @ApiProperty({ description: '每页数量。', example: 20 })
  pageSize!: number;

  @ApiProperty({ description: '总记录数。', example: 6 })
  total!: number;

  @ApiProperty({ description: '总页数。', example: 1 })
  totalPages!: number;
}

export class DeleteLessonResponseDto {
  @ApiProperty({ description: '是否删除成功。', example: true })
  success!: boolean;

  @ApiProperty({ description: '返回说明。', example: '课程已删除' })
  message!: string;
}
