import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LessonEvidenceType } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreateLessonEvidenceDto {
  @ApiProperty({
    description: '证据类型。',
    enum: LessonEvidenceType,
    example: LessonEvidenceType.RESULT_PHOTO,
  })
  @IsEnum(LessonEvidenceType)
  type!: LessonEvidenceType;

  @ApiProperty({
    description: '证据链接。',
    example: 'https://example.com/result-photo.jpg',
  })
  @IsUrl({ require_protocol: true })
  @MaxLength(1000)
  url!: string;

  @ApiPropertyOptional({
    description: '证据备注。',
    example: '课堂作品照片',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
