import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateSubjectStatusDto {
  @ApiProperty({
    description: '新的启用状态。true 表示启用，false 表示停用。',
    example: false,
  })
  @IsBoolean()
  isActive!: boolean;
}
