import { ApiProperty } from '@nestjs/swagger';

export class GuardianAddressSummaryDto {
  @ApiProperty({ description: '地址 ID。', example: 'cmc123addr001' })
  id!: string;

  @ApiProperty({ description: '地址标签。', example: '家里', nullable: true, required: false })
  label!: string | null;

  @ApiProperty({ description: '省份。', example: '天津市' })
  province!: string;

  @ApiProperty({ description: '城市。', example: '天津市' })
  city!: string;

  @ApiProperty({ description: '区县。', example: '南开区' })
  district!: string;

  @ApiProperty({ description: '详细街道。', example: '黄河道 100 号' })
  street!: string;
}

export class GuardianStudentSummaryDto {
  @ApiProperty({ description: '学生档案 ID。', example: 'cmc123student001' })
  studentProfileId!: string;

  @ApiProperty({ description: '学生名称。', example: '小王' })
  displayName!: string;

  @ApiProperty({ description: '年级阶段。', example: 'PRIMARY' })
  gradeLevel!: string;

  @ApiProperty({ description: '与家长关系。', example: 'MOTHER' })
  relation!: string;

  @ApiProperty({ description: '是否主联系人。', example: true })
  isPrimary!: boolean;

  @ApiProperty({ description: '是否可代为预约。', example: true })
  canBook!: boolean;

  @ApiProperty({ description: '是否可查看课程记录。', example: true })
  canViewRecords!: boolean;
}

export class GuardianResponseDto {
  @ApiProperty({ description: '家长档案 ID。', example: 'cmc123guardian001' })
  id!: string;

  @ApiProperty({ description: '关联用户 ID。', example: 'cmc123user001' })
  userId!: string;

  @ApiProperty({ description: '家长展示名称。', example: '王女士' })
  displayName!: string;

  @ApiProperty({
    description: '联系电话。',
    example: '13800138000',
    nullable: true,
    required: false,
  })
  phone!: string | null;

  @ApiProperty({
    description: '紧急联系人姓名。',
    example: '王先生',
    nullable: true,
    required: false,
  })
  emergencyContactName!: string | null;

  @ApiProperty({
    description: '紧急联系人电话。',
    example: '13900139000',
    nullable: true,
    required: false,
  })
  emergencyContactPhone!: string | null;

  @ApiProperty({
    description: '默认服务地址 ID。',
    example: 'cmc123addr001',
    nullable: true,
    required: false,
  })
  defaultServiceAddressId!: string | null;

  @ApiProperty({
    description: '默认服务地址摘要。',
    type: GuardianAddressSummaryDto,
    nullable: true,
    required: false,
  })
  defaultServiceAddress!: GuardianAddressSummaryDto | null;

  @ApiProperty({ description: '创建时间。', example: '2026-03-15T13:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ description: '更新时间。', example: '2026-03-15T13:10:00.000Z' })
  updatedAt!: Date;
}

export class GuardianListResponseDto {
  @ApiProperty({ description: '家长列表。', type: GuardianResponseDto, isArray: true })
  items!: GuardianResponseDto[];

  @ApiProperty({ description: '当前页码。', example: 1 })
  page!: number;

  @ApiProperty({ description: '每页数量。', example: 20 })
  pageSize!: number;

  @ApiProperty({ description: '总记录数。', example: 12 })
  total!: number;

  @ApiProperty({ description: '总页数。', example: 1 })
  totalPages!: number;
}

export class DeleteGuardianResponseDto {
  @ApiProperty({ description: '是否删除成功。', example: true })
  success!: boolean;

  @ApiProperty({ description: '返回说明。', example: '家长档案已删除' })
  message!: string;
}
