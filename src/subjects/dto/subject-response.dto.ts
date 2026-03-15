import { ApiProperty } from '@nestjs/swagger';

export class SubjectResponseDto {
  @ApiProperty({ description: '科目 ID。', example: 'cmc123subjectid' })
  id!: string;

  @ApiProperty({ description: '科目编码。', example: 'PIANO' })
  code!: string;

  @ApiProperty({ description: '科目名称。', example: '钢琴' })
  name!: string;

  @ApiProperty({
    description: '科目描述。',
    example: '适合启蒙、兴趣和考级学习。',
    nullable: true,
    required: false,
  })
  description!: string | null;

  @ApiProperty({ description: '是否启用。', example: true })
  isActive!: boolean;

  @ApiProperty({
    description: '创建时间。',
    example: '2026-03-15T13:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: '更新时间。',
    example: '2026-03-15T13:10:00.000Z',
  })
  updatedAt!: Date;
}

export class SubjectListResponseDto {
  @ApiProperty({
    description: '科目列表。',
    type: SubjectResponseDto,
    isArray: true,
  })
  items!: SubjectResponseDto[];

  @ApiProperty({ description: '当前页码。', example: 1 })
  page!: number;

  @ApiProperty({ description: '每页数量。', example: 20 })
  pageSize!: number;

  @ApiProperty({ description: '总记录数。', example: 8 })
  total!: number;

  @ApiProperty({ description: '总页数。', example: 1 })
  totalPages!: number;
}

export class DeleteSubjectResponseDto {
  @ApiProperty({ description: '是否删除成功。', example: true })
  success!: boolean;

  @ApiProperty({ description: '返回信息。', example: '科目已删除' })
  message!: string;
}
