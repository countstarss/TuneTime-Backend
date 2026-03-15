import { ApiProperty } from '@nestjs/swagger';

export class StudentGuardianResponseDto {
  @ApiProperty({ description: '家长档案 ID。', example: 'cmc123guardian001' })
  guardianProfileId!: string;

  @ApiProperty({ description: '家长名称。', example: '王女士' })
  displayName!: string;

  @ApiProperty({ description: '联系电话。', example: '13800138000', nullable: true })
  phone!: string | null;

  @ApiProperty({ description: '关系。', example: 'MOTHER' })
  relation!: string;

  @ApiProperty({ description: '是否主联系人。', example: true })
  isPrimary!: boolean;

  @ApiProperty({ description: '是否可预约。', example: true })
  canBook!: boolean;

  @ApiProperty({ description: '是否可查看课程记录。', example: true })
  canViewRecords!: boolean;
}

export class StudentResponseDto {
  @ApiProperty({ description: '学生档案 ID。', example: 'cmc123student001' })
  id!: string;

  @ApiProperty({
    description: '关联用户 ID，没有独立账号时可能为空。',
    example: 'cmc123user-student001',
    nullable: true,
    required: false,
  })
  userId!: string | null;

  @ApiProperty({ description: '学生姓名。', example: '小王' })
  displayName!: string;

  @ApiProperty({ description: '年级阶段。', example: 'PRIMARY' })
  gradeLevel!: string;

  @ApiProperty({
    description: '出生日期。',
    example: '2017-09-01T00:00:00.000Z',
    nullable: true,
    required: false,
  })
  dateOfBirth!: Date | null;

  @ApiProperty({
    description: '学校名称。',
    example: '天津市实验小学',
    nullable: true,
    required: false,
  })
  schoolName!: string | null;

  @ApiProperty({
    description: '学习目标。',
    example: '希望半年内完成钢琴启蒙。',
    nullable: true,
    required: false,
  })
  learningGoals!: string | null;

  @ApiProperty({
    description: '特殊说明。',
    example: '需要家长陪同。',
    nullable: true,
    required: false,
  })
  specialNeeds!: string | null;

  @ApiProperty({ description: '时区。', example: 'Asia/Shanghai' })
  timezone!: string;

  @ApiProperty({
    description: '关联的家长列表。',
    type: StudentGuardianResponseDto,
    isArray: true,
  })
  guardians!: StudentGuardianResponseDto[];

  @ApiProperty({ description: '创建时间。', example: '2026-03-15T13:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ description: '更新时间。', example: '2026-03-15T13:10:00.000Z' })
  updatedAt!: Date;
}

export class StudentListResponseDto {
  @ApiProperty({ description: '学生列表。', type: StudentResponseDto, isArray: true })
  items!: StudentResponseDto[];

  @ApiProperty({ description: '当前页码。', example: 1 })
  page!: number;

  @ApiProperty({ description: '每页数量。', example: 20 })
  pageSize!: number;

  @ApiProperty({ description: '总记录数。', example: 20 })
  total!: number;

  @ApiProperty({ description: '总页数。', example: 1 })
  totalPages!: number;
}

export class DeleteStudentResponseDto {
  @ApiProperty({ description: '是否删除成功。', example: true })
  success!: boolean;

  @ApiProperty({ description: '返回说明。', example: '学生档案已删除' })
  message!: string;
}
