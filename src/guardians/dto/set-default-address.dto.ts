import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class SetGuardianDefaultAddressDto {
  @ApiPropertyOptional({
    description: '新的默认服务地址 ID。传 null 或不传表示清空默认地址。',
    example: 'cmc123addr001',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @Length(8, 36)
  defaultServiceAddressId?: string | null;
}
