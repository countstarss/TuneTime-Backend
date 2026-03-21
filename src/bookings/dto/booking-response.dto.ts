import { ApiProperty } from '@nestjs/swagger';

export class BookingTeacherSummaryDto {
  @ApiProperty({ description: '老师档案 ID。', example: 'cmc123teacher001' })
  id!: string;

  @ApiProperty({
    description: '老师用户 ID。',
    example: 'cmc123user-teacher001',
  })
  userId!: string;

  @ApiProperty({ description: '老师展示名。', example: '李老师' })
  displayName!: string;

  @ApiProperty({ description: '审核状态。', example: 'APPROVED' })
  verificationStatus!: string;
}

export class BookingStudentSummaryDto {
  @ApiProperty({ description: '学生档案 ID。', example: 'cmc123student001' })
  id!: string;

  @ApiProperty({
    description: '关联用户 ID。',
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

export class BookingGuardianSummaryDto {
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

  @ApiProperty({
    description: '联系电话。',
    example: '13800138000',
    nullable: true,
    required: false,
  })
  phone!: string | null;
}

export class BookingSubjectSummaryDto {
  @ApiProperty({ description: '科目 ID。', example: 'cmc123subject001' })
  id!: string;

  @ApiProperty({ description: '科目编码。', example: 'PIANO' })
  code!: string;

  @ApiProperty({ description: '科目名称。', example: '钢琴' })
  name!: string;
}

export class BookingAddressSummaryDto {
  @ApiProperty({ description: '地址 ID。', example: 'cmc123addr001' })
  id!: string;

  @ApiProperty({
    description: '地址所属用户 ID。',
    example: 'cmc123user-guardian001',
  })
  userId!: string;

  @ApiProperty({
    description: '地址标签。',
    example: '家里',
    nullable: true,
    required: false,
  })
  label!: string | null;

  @ApiProperty({ description: '联系人。', example: '王女士' })
  contactName!: string;

  @ApiProperty({ description: '联系电话。', example: '13800138000' })
  contactPhone!: string;

  @ApiProperty({ description: '国家代码。', example: 'CN' })
  country!: string;

  @ApiProperty({ description: '省份。', example: '天津市' })
  province!: string;

  @ApiProperty({ description: '城市。', example: '天津市' })
  city!: string;

  @ApiProperty({ description: '区县。', example: '南开区' })
  district!: string;

  @ApiProperty({ description: '街道。', example: '黄河道 100 号' })
  street!: string;

  @ApiProperty({
    description: '楼栋补充信息。',
    example: '3 号楼 2 单元 501',
    nullable: true,
    required: false,
  })
  building!: string | null;
}

export class BookingRescheduleRequestDto {
  @ApiProperty({ description: '改约请求 ID。', example: 'reschedule_001' })
  id!: string;

  @ApiProperty({ description: '发起角色。', example: 'GUARDIAN' })
  initiatorRole!: string;

  @ApiProperty({ description: '发起用户 ID。', example: 'user_001' })
  initiatorUserId!: string;

  @ApiProperty({
    description: '建议的新开始时间。',
    example: '2026-03-28T10:00:00.000Z',
  })
  proposedStartAt!: Date;

  @ApiProperty({
    description: '建议的新结束时间。',
    example: '2026-03-28T11:00:00.000Z',
  })
  proposedEndAt!: Date;

  @ApiProperty({
    description: '改约原因。',
    example: '老师临时冲突，希望顺延到周六上午。',
    nullable: true,
    required: false,
  })
  reason!: string | null;

  @ApiProperty({ description: '改约状态。', example: 'PENDING' })
  status!: string;

  @ApiProperty({
    description: '响应时间。',
    example: '2026-03-27T09:00:00.000Z',
    nullable: true,
    required: false,
  })
  respondedAt!: Date | null;

  @ApiProperty({
    description: '响应人用户 ID。',
    example: 'user_002',
    nullable: true,
    required: false,
  })
  respondedByUserId!: string | null;

  @ApiProperty({
    description: '创建时间。',
    example: '2026-03-27T08:00:00.000Z',
  })
  createdAt!: Date;
}

export class BookingResponseDto {
  @ApiProperty({ description: '预约 ID。', example: 'cmc123booking001' })
  id!: string;

  @ApiProperty({ description: '预约单号。', example: 'BK202603150001' })
  bookingNo!: string;

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

  @ApiProperty({ description: '科目 ID。', example: 'cmc123subject001' })
  subjectId!: string;

  @ApiProperty({ description: '服务地址 ID。', example: 'cmc123addr001' })
  serviceAddressId!: string;

  @ApiProperty({
    description: '开始时间。',
    example: '2026-03-20T09:00:00.000Z',
  })
  startAt!: Date;

  @ApiProperty({
    description: '结束时间。',
    example: '2026-03-20T10:00:00.000Z',
  })
  endAt!: Date;

  @ApiProperty({ description: '时区。', example: 'Asia/Shanghai' })
  timezone!: string;

  @ApiProperty({ description: '预约状态。', example: 'PENDING_ACCEPTANCE' })
  status!: string;

  @ApiProperty({
    description: '状态备注/拒单原因/取消说明。',
    example: '老师周五晚临时无法上门。',
    nullable: true,
    required: false,
  })
  statusRemark!: string | null;

  @ApiProperty({
    description: '取消原因。',
    example: 'STUDENT_REQUEST',
    nullable: true,
    required: false,
  })
  cancellationReason!: string | null;

  @ApiProperty({
    description: '取消时间。',
    example: '2026-03-18T10:30:00.000Z',
    nullable: true,
    required: false,
  })
  cancelledAt!: Date | null;

  @ApiProperty({
    description: '取消操作用户 ID。',
    example: 'cmc123user001',
    nullable: true,
    required: false,
  })
  cancelledByUserId!: string | null;

  @ApiProperty({ description: '是否试听单。', example: true })
  isTrial!: boolean;

  @ApiProperty({
    description: '老师接单时间。',
    example: '2026-03-18T09:00:00.000Z',
    nullable: true,
    required: false,
  })
  teacherAcceptedAt!: Date | null;

  @ApiProperty({
    description: '家长确认时间。',
    example: '2026-03-18T12:00:00.000Z',
    nullable: true,
    required: false,
  })
  guardianConfirmedAt!: Date | null;

  @ApiProperty({ description: '小时费。', example: 180 })
  hourlyRate!: number;

  @ApiProperty({ description: '课时长度，单位分钟。', example: 60 })
  durationMinutes!: number;

  @ApiProperty({ description: '小计金额。', example: 180 })
  subtotalAmount!: number;

  @ApiProperty({ description: '优惠金额。', example: 20 })
  discountAmount!: number;

  @ApiProperty({ description: '平台服务费。', example: 8 })
  platformFeeAmount!: number;

  @ApiProperty({ description: '路费。', example: 15 })
  travelFeeAmount!: number;

  @ApiProperty({ description: '应付总金额。', example: 183 })
  totalAmount!: number;

  @ApiProperty({ description: '币种。', example: 'CNY' })
  currency!: string;

  @ApiProperty({ description: '支付状态。', example: 'UNPAID' })
  paymentStatus!: string;

  @ApiProperty({
    description: '支付截止时间。',
    example: '2026-03-19T12:00:00.000Z',
    nullable: true,
    required: false,
  })
  paymentDueAt!: Date | null;

  @ApiProperty({
    description: '课前计划摘要。',
    example: '试听课重点了解孩子基础。',
    nullable: true,
    required: false,
  })
  planSummary!: string | null;

  @ApiProperty({
    description: '备注。',
    example: '需要自备节拍器。',
    nullable: true,
    required: false,
  })
  notes!: string | null;

  @ApiProperty({ description: '老师摘要。', type: BookingTeacherSummaryDto })
  teacher!: BookingTeacherSummaryDto;

  @ApiProperty({ description: '学生摘要。', type: BookingStudentSummaryDto })
  student!: BookingStudentSummaryDto;

  @ApiProperty({ description: '家长摘要。', type: BookingGuardianSummaryDto })
  guardian!: BookingGuardianSummaryDto;

  @ApiProperty({ description: '科目摘要。', type: BookingSubjectSummaryDto })
  subject!: BookingSubjectSummaryDto;

  @ApiProperty({ description: '地址摘要。', type: BookingAddressSummaryDto })
  serviceAddress!: BookingAddressSummaryDto;

  @ApiProperty({
    description: '改约请求列表。',
    type: BookingRescheduleRequestDto,
    isArray: true,
  })
  rescheduleRequests!: BookingRescheduleRequestDto[];

  @ApiProperty({
    description: '创建时间。',
    example: '2026-03-15T13:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: '更新时间。',
    example: '2026-03-15T13:10:00.000Z',
  })
  updatedAt!: Date;
}

export class BookingListResponseDto {
  @ApiProperty({
    description: '预约列表。',
    type: BookingResponseDto,
    isArray: true,
  })
  items!: BookingResponseDto[];

  @ApiProperty({ description: '当前页码。', example: 1 })
  page!: number;

  @ApiProperty({ description: '每页数量。', example: 20 })
  pageSize!: number;

  @ApiProperty({ description: '总记录数。', example: 12 })
  total!: number;

  @ApiProperty({ description: '总页数。', example: 1 })
  totalPages!: number;
}

export class DeleteBookingResponseDto {
  @ApiProperty({ description: '是否删除成功。', example: true })
  success!: boolean;

  @ApiProperty({ description: '返回说明。', example: '预约已删除' })
  message!: string;
}
