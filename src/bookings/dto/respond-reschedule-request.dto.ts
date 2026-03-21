import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum RescheduleResponseAction {
  ACCEPT = 'ACCEPT',
  REJECT = 'REJECT',
}

export class RespondRescheduleRequestDto {
  @ApiProperty({
    description: '改约响应动作。',
    enum: RescheduleResponseAction,
    example: RescheduleResponseAction.ACCEPT,
  })
  @IsEnum(RescheduleResponseAction)
  action!: RescheduleResponseAction;

  @ApiPropertyOptional({
    description: '拒绝原因或补充说明。',
    example: '该时间段老师已有其他预约。',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
