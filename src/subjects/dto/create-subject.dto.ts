import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class CreateSubjectDto {
  @ApiProperty({
    description: '科目编码，建议使用大写英文或下划线，后续可用于程序枚举和筛选。',
    example: 'PIANO',
  })
  @IsString()
  @Length(2, 32)
  @Matches(/^[A-Z0-9_]+$/, {
    message: '科目编码仅支持大写字母、数字和下划线',
  })
  code!: string;

  @ApiProperty({
    description: '科目名称，用于前台展示。',
    example: '钢琴',
  })
  @IsString()
  @Length(1, 64)
  name!: string;

  @ApiPropertyOptional({
    description: '科目描述，可用于补充适用人群、学习目标等信息。',
    example: '适合儿童启蒙、成人兴趣学习和考级课程。',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: '是否启用该科目。默认启用。',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
