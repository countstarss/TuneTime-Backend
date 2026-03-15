import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetDefaultAddressDto {
  @ApiProperty({
    description: '是否设为默认地址。当前模块只支持设为 true。',
    example: true,
  })
  @IsBoolean()
  isDefault!: boolean;
}
