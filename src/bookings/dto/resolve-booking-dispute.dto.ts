import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BookingCompletionStatus,
  ResponsibilityType,
  SettlementReadiness,
} from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class ResolveBookingDisputeDto {
  @ApiProperty({
    description: '责任方。',
    enum: ResponsibilityType,
    example: ResponsibilityType.TEACHER,
  })
  @IsEnum(ResponsibilityType)
  responsibilityType!: ResponsibilityType;

  @ApiProperty({
    description: '处理结论。',
    example: '经核查老师迟到，工单关闭并保留争议记录。',
  })
  @IsString()
  @MaxLength(1000)
  resolution!: string;

  @ApiPropertyOptional({
    description: '处理后完课状态。',
    enum: BookingCompletionStatus,
    example: BookingCompletionStatus.DISPUTED,
  })
  @IsOptional()
  @IsEnum(BookingCompletionStatus)
  completionStatus?: BookingCompletionStatus;

  @ApiPropertyOptional({
    description: '处理后结算资格。',
    enum: SettlementReadiness,
    example: SettlementReadiness.BLOCKED,
  })
  @IsOptional()
  @IsEnum(SettlementReadiness)
  settlementReadiness?: SettlementReadiness;
}
