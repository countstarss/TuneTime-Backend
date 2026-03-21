import { ApiProperty } from '@nestjs/swagger';
import { PlatformRole } from '@prisma/client';
import { IsDateString, IsEnum } from 'class-validator';

export class CalendarQueryDto {
  @ApiProperty({
    description: '当前查看课表的角色。',
    enum: PlatformRole,
    example: PlatformRole.GUARDIAN,
  })
  @IsEnum(PlatformRole)
  role!: PlatformRole;

  @ApiProperty({
    description: '开始时间下限。',
    example: '2026-03-01T00:00:00.000Z',
  })
  @IsDateString()
  from!: string;

  @ApiProperty({
    description: '开始时间上限。',
    example: '2026-04-01T00:00:00.000Z',
  })
  @IsDateString()
  to!: string;
}

export class CalendarStudentSummaryDto {
  @ApiProperty({ description: '学生档案 ID。' })
  id!: string;

  @ApiProperty({ description: '学生姓名。' })
  displayName!: string;

  @ApiProperty({ description: '年级。', nullable: true, required: false })
  gradeLevel!: string | null;
}

export class CalendarTeacherSummaryDto {
  @ApiProperty({ description: '老师档案 ID。' })
  id!: string;

  @ApiProperty({ description: '老师姓名。' })
  displayName!: string;
}

export class CalendarGuardianSummaryDto {
  @ApiProperty({ description: '家长档案 ID。', nullable: true, required: false })
  id!: string | null;

  @ApiProperty({ description: '家长姓名。', nullable: true, required: false })
  displayName!: string | null;
}

export class CalendarItemDto {
  @ApiProperty({ description: '预约 ID。' })
  bookingId!: string;

  @ApiProperty({ description: '课程记录 ID。', nullable: true, required: false })
  lessonId!: string | null;

  @ApiProperty({ description: '开始时间。' })
  startAt!: Date;

  @ApiProperty({ description: '结束时间。' })
  endAt!: Date;

  @ApiProperty({ description: '时区。' })
  timezone!: string;

  @ApiProperty({ description: '预约状态。' })
  status!: string;

  @ApiProperty({ description: '支付状态。' })
  paymentStatus!: string;

  @ApiProperty({
    description: '出勤状态。',
    nullable: true,
    required: false,
  })
  attendanceStatus!: string | null;

  @ApiProperty({ description: '科目名称。' })
  subjectName!: string;

  @ApiProperty({ description: '上课地址摘要。' })
  serviceAddressSummary!: string;

  @ApiProperty({ description: '订单备注。', nullable: true, required: false })
  statusRemark!: string | null;

  @ApiProperty({ description: '是否试听。' })
  isTrial!: boolean;

  @ApiProperty({ type: CalendarTeacherSummaryDto })
  teacher!: CalendarTeacherSummaryDto;

  @ApiProperty({ type: CalendarStudentSummaryDto })
  student!: CalendarStudentSummaryDto;

  @ApiProperty({ type: CalendarGuardianSummaryDto })
  guardian!: CalendarGuardianSummaryDto;
}

export class CalendarResponseDto {
  @ApiProperty({ type: CalendarItemDto, isArray: true })
  items!: CalendarItemDto[];
}
