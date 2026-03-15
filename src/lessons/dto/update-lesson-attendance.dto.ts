import { ApiProperty } from '@nestjs/swagger';
import { LessonAttendanceStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateLessonAttendanceDto {
  @ApiProperty({
    description: '新的出勤状态。适用于手动更正迟到、缺席、取消等状态。',
    enum: LessonAttendanceStatus,
    example: LessonAttendanceStatus.STUDENT_ABSENT,
  })
  @IsEnum(LessonAttendanceStatus)
  attendanceStatus!: LessonAttendanceStatus;
}
