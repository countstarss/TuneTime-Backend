import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingCancellationReason } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class CancelBookingDto {
  @ApiProperty({
    description: '取消原因。',
    enum: BookingCancellationReason,
    example: BookingCancellationReason.STUDENT_REQUEST,
  })
  @IsEnum(BookingCancellationReason)
  cancellationReason!: BookingCancellationReason;

  @ApiPropertyOptional({
    description: '执行取消操作的用户 ID。',
    example: 'cmc123user001',
  })
  @IsOptional()
  @IsString()
  @Length(8, 36)
  cancelledByUserId?: string;

  @ApiPropertyOptional({
    description: '取消时间。未传时默认使用当前时间。',
    example: '2026-03-18T10:30:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  cancelledAt?: string;
}
