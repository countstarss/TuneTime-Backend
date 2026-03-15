import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateGuardianDto {
  @ApiProperty({
    description: '关联的用户 ID，对应 users 表中的主键。',
    example: 'cmc123user001',
  })
  @IsString()
  @Length(8, 36)
  userId!: string;

  @ApiProperty({
    description: '家长展示名称。',
    example: '王女士',
  })
  @IsString()
  @Length(1, 64)
  displayName!: string;

  @ApiPropertyOptional({
    description: '家长联系电话。',
    example: '13800138000',
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @ApiPropertyOptional({
    description: '紧急联系人姓名。',
    example: '王先生',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  emergencyContactName?: string;

  @ApiPropertyOptional({
    description: '紧急联系人电话。',
    example: '13900139000',
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  emergencyContactPhone?: string;

  @ApiPropertyOptional({
    description: '默认服务地址 ID。若传入，系统会校验该地址是否属于当前 userId。',
    example: 'cmc123addr001',
  })
  @IsOptional()
  @IsString()
  @Length(8, 36)
  defaultServiceAddressId?: string;
}
