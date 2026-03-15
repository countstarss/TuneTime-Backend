import { ApiProperty } from '@nestjs/swagger';

export class TeacherSubjectResponseDto {
  @ApiProperty({ description: '老师科目关系 ID。', example: 'cmc123teacher-subject001' })
  id!: string;

  @ApiProperty({ description: '科目 ID。', example: 'cmc123subject001' })
  subjectId!: string;

  @ApiProperty({ description: '科目编码。', example: 'PIANO' })
  subjectCode!: string;

  @ApiProperty({ description: '科目名称。', example: '钢琴' })
  subjectName!: string;

  @ApiProperty({ description: '标准课时费。', example: 180 })
  hourlyRate!: number;

  @ApiProperty({ description: '试听价。', example: 99, nullable: true, required: false })
  trialRate!: number | null;

  @ApiProperty({ description: '教学年限。', example: 5 })
  experienceYears!: number;

  @ApiProperty({ description: '是否启用。', example: true })
  isActive!: boolean;
}

export class TeacherServiceAreaResponseDto {
  @ApiProperty({ description: '服务区域 ID。', example: 'cmc123area001' })
  id!: string;

  @ApiProperty({ description: '省份。', example: '天津市' })
  province!: string;

  @ApiProperty({ description: '城市。', example: '天津市' })
  city!: string;

  @ApiProperty({ description: '区县。', example: '南开区' })
  district!: string;

  @ApiProperty({ description: '服务半径。', example: 8 })
  radiusKm!: number;
}

export class TeacherAvailabilityRuleResponseDto {
  @ApiProperty({ description: '规则 ID。', example: 'cmc123rule001' })
  id!: string;

  @ApiProperty({ description: '星期。', example: 'SATURDAY' })
  weekday!: string;

  @ApiProperty({ description: '开始分钟。', example: 540 })
  startMinute!: number;

  @ApiProperty({ description: '结束分钟。', example: 720 })
  endMinute!: number;

  @ApiProperty({ description: '单个时间段时长。', example: 60 })
  slotDurationMinutes!: number;

  @ApiProperty({ description: '缓冲时间。', example: 0 })
  bufferMinutes!: number;

  @ApiProperty({ description: '是否启用。', example: true })
  isActive!: boolean;

  @ApiProperty({ description: '生效起始日期。', example: '2026-03-15T00:00:00.000Z', nullable: true, required: false })
  effectiveFrom!: Date | null;

  @ApiProperty({ description: '生效结束日期。', example: '2026-12-31T00:00:00.000Z', nullable: true, required: false })
  effectiveTo!: Date | null;
}

export class TeacherCredentialResponseDto {
  @ApiProperty({ description: '资质 ID。', example: 'cmc123credential001' })
  id!: string;

  @ApiProperty({ description: '资质类型。', example: 'TEACHING_LICENSE' })
  credentialType!: string;

  @ApiProperty({ description: '资质名称。', example: '钢琴教师资格证' })
  name!: string;

  @ApiProperty({ description: '文件地址。', example: 'https://example.com/license.pdf' })
  fileUrl!: string;

  @ApiProperty({ description: '审核状态。', example: 'PENDING' })
  reviewStatus!: string;

  @ApiProperty({ description: '审核备注。', example: '待补资料', nullable: true, required: false })
  reviewNotes!: string | null;

  @ApiProperty({ description: '签发机构。', example: '中国音乐学院', nullable: true, required: false })
  issuedBy!: string | null;

  @ApiProperty({ description: '签发日期。', example: '2024-01-01T00:00:00.000Z', nullable: true, required: false })
  issuedAt!: Date | null;

  @ApiProperty({ description: '过期日期。', example: '2030-01-01T00:00:00.000Z', nullable: true, required: false })
  expiresAt!: Date | null;

  @ApiProperty({ description: '审核人用户 ID。', example: 'cmc123admin001', nullable: true, required: false })
  reviewedByUserId!: string | null;

  @ApiProperty({ description: '审核时间。', example: '2026-03-20T00:00:00.000Z', nullable: true, required: false })
  reviewedAt!: Date | null;
}

export class TeacherResponseDto {
  @ApiProperty({ description: '老师档案 ID。', example: 'cmc123teacher001' })
  id!: string;

  @ApiProperty({ description: '关联用户 ID。', example: 'cmc123user-teacher001' })
  userId!: string;

  @ApiProperty({ description: '老师展示名。', example: '李老师' })
  displayName!: string;

  @ApiProperty({ description: '老师简介。', example: '10 年教学经验。', nullable: true, required: false })
  bio!: string | null;

  @ApiProperty({ description: '雇佣类型。', example: 'PART_TIME' })
  employmentType!: string;

  @ApiProperty({ description: '审核状态。', example: 'APPROVED' })
  verificationStatus!: string;

  @ApiProperty({ description: '基础小时费。', example: 180 })
  baseHourlyRate!: number;

  @ApiProperty({ description: '默认服务半径。', example: 10 })
  serviceRadiusKm!: number;

  @ApiProperty({ description: '是否接受试听。', example: true })
  acceptTrial!: boolean;

  @ApiProperty({ description: '最大行程分钟数。', example: 60 })
  maxTravelMinutes!: number;

  @ApiProperty({ description: '时区。', example: 'Asia/Shanghai' })
  timezone!: string;

  @ApiProperty({ description: '平均评分。', example: 4.8 })
  ratingAvg!: number;

  @ApiProperty({ description: '评分人数。', example: 10 })
  ratingCount!: number;

  @ApiProperty({ description: '累计完成课程数。', example: 100 })
  totalCompletedLessons!: number;

  @ApiProperty({ description: '协议确认时间。', example: '2026-03-15T08:00:00.000Z', nullable: true, required: false })
  agreementAcceptedAt!: Date | null;

  @ApiProperty({ description: '协议版本。', example: 'v1.0.0', nullable: true, required: false })
  agreementVersion!: string | null;

  @ApiProperty({ description: '面试时间。', example: '2026-03-16T10:00:00.000Z', nullable: true, required: false })
  interviewedAt!: Date | null;

  @ApiProperty({ description: '面试备注。', example: '表达清晰', nullable: true, required: false })
  interviewNotes!: string | null;

  @ApiProperty({ description: '入驻完成时间。', example: '2026-03-17T12:00:00.000Z', nullable: true, required: false })
  onboardingCompletedAt!: Date | null;

  @ApiProperty({ description: '老师科目配置。', type: TeacherSubjectResponseDto, isArray: true })
  subjects!: TeacherSubjectResponseDto[];

  @ApiProperty({ description: '服务区域列表。', type: TeacherServiceAreaResponseDto, isArray: true })
  serviceAreas!: TeacherServiceAreaResponseDto[];

  @ApiProperty({ description: '可预约规则列表。', type: TeacherAvailabilityRuleResponseDto, isArray: true })
  availabilityRules!: TeacherAvailabilityRuleResponseDto[];

  @ApiProperty({ description: '资质材料列表。', type: TeacherCredentialResponseDto, isArray: true })
  credentials!: TeacherCredentialResponseDto[];

  @ApiProperty({ description: '创建时间。', example: '2026-03-15T13:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ description: '更新时间。', example: '2026-03-15T13:10:00.000Z' })
  updatedAt!: Date;
}

export class TeacherListResponseDto {
  @ApiProperty({ description: '老师列表。', type: TeacherResponseDto, isArray: true })
  items!: TeacherResponseDto[];

  @ApiProperty({ description: '当前页码。', example: 1 })
  page!: number;

  @ApiProperty({ description: '每页数量。', example: 20 })
  pageSize!: number;

  @ApiProperty({ description: '总记录数。', example: 8 })
  total!: number;

  @ApiProperty({ description: '总页数。', example: 1 })
  totalPages!: number;
}

export class DeleteTeacherResponseDto {
  @ApiProperty({ description: '是否删除成功。', example: true })
  success!: boolean;

  @ApiProperty({ description: '返回说明。', example: '老师档案已删除' })
  message!: string;
}
