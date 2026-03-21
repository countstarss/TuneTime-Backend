import { ApiProperty } from '@nestjs/swagger';

export class TeacherWorkbenchStudentSummaryDto {
  @ApiProperty({ description: '学生档案 ID。', example: 'student_001' })
  id!: string;

  @ApiProperty({ description: '学生姓名。', example: '小宇' })
  displayName!: string;

  @ApiProperty({
    description: '学生年级。',
    example: 'PRIMARY',
    nullable: true,
    required: false,
  })
  gradeLevel!: string | null;
}

export class TeacherWorkbenchGuardianSummaryDto {
  @ApiProperty({
    description: '家长档案 ID。',
    example: 'guardian_001',
    nullable: true,
    required: false,
  })
  id!: string | null;

  @ApiProperty({
    description: '家长姓名。',
    example: '王女士',
    nullable: true,
    required: false,
  })
  displayName!: string | null;

  @ApiProperty({
    description: '家长联系电话。',
    example: '13800138000',
    nullable: true,
    required: false,
  })
  phone!: string | null;
}

export class TeacherWorkbenchBookingListItemDto {
  @ApiProperty({ description: '预约 ID。', example: 'booking_001' })
  id!: string;

  @ApiProperty({ description: '预约单号。', example: 'BK202603210001' })
  bookingNo!: string;

  @ApiProperty({ description: '预约状态。', example: 'PENDING_ACCEPTANCE' })
  status!: string;

  @ApiProperty({ description: '支付状态。', example: 'UNPAID' })
  paymentStatus!: string;

  @ApiProperty({
    description: '开始时间。',
    example: '2026-03-24T11:00:00.000Z',
  })
  startAt!: Date;

  @ApiProperty({
    description: '结束时间。',
    example: '2026-03-24T12:00:00.000Z',
  })
  endAt!: Date;

  @ApiProperty({ description: '科目名称。', example: '钢琴' })
  subjectName!: string;

  @ApiProperty({
    description: '上课地址摘要。',
    example: '天津市 南开区 黄河道 100 号 1 栋 1201',
  })
  serviceAddressSummary!: string;

  @ApiProperty({
    description: '地址标签。',
    example: '家里',
    nullable: true,
    required: false,
  })
  serviceAddressLabel!: string | null;

  @ApiProperty({ description: '是否试听单。', example: true })
  isTrial!: boolean;

  @ApiProperty({
    description: '预约备注。',
    example: '需要老师自备节拍器。',
    nullable: true,
    required: false,
  })
  notes!: string | null;

  @ApiProperty({
    description: '状态备注/拒单原因/取消说明。',
    example: '老师临时有事，需要改约。',
    nullable: true,
    required: false,
  })
  statusRemark!: string | null;

  @ApiProperty({
    description: '课前计划摘要。',
    example: '试听课先做基础评估。',
    nullable: true,
    required: false,
  })
  planSummary!: string | null;

  @ApiProperty({
    description: '学生摘要。',
    type: TeacherWorkbenchStudentSummaryDto,
  })
  student!: TeacherWorkbenchStudentSummaryDto;

  @ApiProperty({
    description: '家长摘要。',
    type: TeacherWorkbenchGuardianSummaryDto,
  })
  guardian!: TeacherWorkbenchGuardianSummaryDto;
}

export class TeacherWorkbenchBookingDetailDto extends TeacherWorkbenchBookingListItemDto {
  @ApiProperty({
    description: '老师接单时间。',
    nullable: true,
    required: false,
  })
  teacherAcceptedAt!: Date | null;

  @ApiProperty({
    description: '家长确认时间。',
    nullable: true,
    required: false,
  })
  guardianConfirmedAt!: Date | null;

  @ApiProperty({ description: '创建时间。' })
  createdAt!: Date;

  @ApiProperty({ description: '更新时间。' })
  updatedAt!: Date;

  @ApiProperty({ description: '时区。', example: 'Asia/Shanghai' })
  timezone!: string;

  @ApiProperty({ description: '课时长度（分钟）。', example: 60 })
  durationMinutes!: number;

  @ApiProperty({ description: '订单总金额。', example: 200 })
  totalAmount!: number;

  @ApiProperty({ description: '联系人姓名。', example: '王女士' })
  contactName!: string;

  @ApiProperty({ description: '联系人手机号。', example: '13800138000' })
  contactPhone!: string;

  @ApiProperty({
    description: '取消原因。',
    example: 'TEACHER_REQUEST',
    nullable: true,
    required: false,
  })
  cancellationReason!: string | null;
}

export class TeacherWorkbenchPendingSummaryDto {
  @ApiProperty({ description: '待接单数量。', example: 1 })
  pendingAcceptance!: number;

  @ApiProperty({ description: '待支付数量。', example: 1 })
  pendingPayment!: number;

  @ApiProperty({ description: '已确认数量。', example: 1 })
  confirmed!: number;
}

export class TeacherWorkbenchPendingBookingListResponseDto {
  @ApiProperty({
    description: '待处理预约列表。',
    type: TeacherWorkbenchBookingListItemDto,
    isArray: true,
  })
  items!: TeacherWorkbenchBookingListItemDto[];

  @ApiProperty({
    description: '状态汇总。',
    type: TeacherWorkbenchPendingSummaryDto,
  })
  summary!: TeacherWorkbenchPendingSummaryDto;

  @ApiProperty({ description: '当前页码。', example: 1 })
  page!: number;

  @ApiProperty({ description: '每页数量。', example: 20 })
  pageSize!: number;

  @ApiProperty({ description: '总记录数。', example: 3 })
  total!: number;

  @ApiProperty({ description: '总页数。', example: 1 })
  totalPages!: number;
}
