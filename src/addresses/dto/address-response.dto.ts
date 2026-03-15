import { ApiProperty } from '@nestjs/swagger';

export class AddressResponseDto {
  @ApiProperty({ description: '地址 ID。', example: 'cmc123addr001' })
  id!: string;

  @ApiProperty({ description: '所属用户 ID。', example: 'cmc123user001' })
  userId!: string;

  @ApiProperty({ description: '地址标签。', example: '家里', nullable: true, required: false })
  label!: string | null;

  @ApiProperty({ description: '联系人姓名。', example: '王女士' })
  contactName!: string;

  @ApiProperty({ description: '联系人电话。', example: '13800138000' })
  contactPhone!: string;

  @ApiProperty({ description: '国家代码。', example: 'CN' })
  country!: string;

  @ApiProperty({ description: '省份。', example: '天津市' })
  province!: string;

  @ApiProperty({ description: '城市。', example: '天津市' })
  city!: string;

  @ApiProperty({ description: '区县。', example: '南开区' })
  district!: string;

  @ApiProperty({ description: '街道地址。', example: '黄河道 100 号' })
  street!: string;

  @ApiProperty({ description: '楼栋信息。', example: '3 号楼 2 单元 501', nullable: true, required: false })
  building!: string | null;

  @ApiProperty({ description: '纬度。', example: 39.1267, nullable: true, required: false })
  latitude!: number | null;

  @ApiProperty({ description: '经度。', example: 117.2059, nullable: true, required: false })
  longitude!: number | null;

  @ApiProperty({ description: '是否默认地址。', example: true })
  isDefault!: boolean;

  @ApiProperty({ description: '创建时间。', example: '2026-03-15T13:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ description: '更新时间。', example: '2026-03-15T13:10:00.000Z' })
  updatedAt!: Date;
}

export class AddressListResponseDto {
  @ApiProperty({ description: '地址列表。', type: AddressResponseDto, isArray: true })
  items!: AddressResponseDto[];

  @ApiProperty({ description: '当前页码。', example: 1 })
  page!: number;

  @ApiProperty({ description: '每页数量。', example: 20 })
  pageSize!: number;

  @ApiProperty({ description: '总记录数。', example: 3 })
  total!: number;

  @ApiProperty({ description: '总页数。', example: 1 })
  totalPages!: number;
}

export class DeleteAddressResponseDto {
  @ApiProperty({ description: '是否删除成功。', example: true })
  success!: boolean;

  @ApiProperty({ description: '返回说明。', example: '地址已删除' })
  message!: string;
}
