import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class CreateLessonDto {
  @ApiProperty({ description: '关联预约 ID。', example: 'cmc123booking001' })
  @IsString()
  @Length(8, 36)
  bookingId!: string;
}
