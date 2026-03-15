import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import {
  AddressListResponseDto,
  AddressResponseDto,
  DeleteAddressResponseDto,
} from './dto/address-response.dto';
import { ListAddressesQueryDto } from './dto/list-addresses-query.dto';
import { SetDefaultAddressDto } from './dto/set-default-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@ApiTags('地址管理')
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Post()
  @ApiOperation({
    summary: '创建地址',
    description: '创建用户地址，可在创建时直接设为默认地址。',
  })
  @ApiBody({ type: CreateAddressDto })
  @ApiResponse({
    status: 201,
    description: '创建成功。',
    type: AddressResponseDto,
  })
  create(@Body() dto: CreateAddressDto): Promise<AddressResponseDto> {
    return this.addressesService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: '分页查询地址列表',
    description: '支持按用户、城市、区县、默认地址和关键字筛选。',
  })
  @ApiQuery({ type: ListAddressesQueryDto })
  @ApiOkResponse({
    description: '查询成功。',
    type: AddressListResponseDto,
  })
  findAll(
    @Query() query: ListAddressesQueryDto,
  ): Promise<AddressListResponseDto> {
    return this.addressesService.findAll(query);
  }

  @Get('user/:userId')
  @ApiOperation({
    summary: '按用户查询地址列表',
    description: '设置页、下单页通常会用到该接口。',
  })
  @ApiParam({ name: 'userId', description: '用户 ID。' })
  @ApiOkResponse({
    description: '查询成功。',
    type: AddressResponseDto,
    isArray: true,
  })
  findByUserId(@Param('userId') userId: string): Promise<AddressResponseDto[]> {
    return this.addressesService.findByUserId(userId);
  }

  @Get('user/:userId/default')
  @ApiOperation({
    summary: '查询用户默认地址',
    description: '下单和家长资料默认回填时常用。',
  })
  @ApiParam({ name: 'userId', description: '用户 ID。' })
  @ApiOkResponse({
    description: '查询成功。',
    type: AddressResponseDto,
  })
  @ApiNotFoundResponse({ description: '未找到该用户的默认地址。' })
  findDefaultByUserId(
    @Param('userId') userId: string,
  ): Promise<AddressResponseDto> {
    return this.addressesService.findDefaultByUserId(userId);
  }

  @Get(':id')
  @ApiOperation({
    summary: '查询地址详情',
    description: '根据地址 ID 查询详情。',
  })
  @ApiParam({ name: 'id', description: '地址 ID。' })
  @ApiOkResponse({
    description: '查询成功。',
    type: AddressResponseDto,
  })
  @ApiNotFoundResponse({ description: '未找到对应地址。' })
  findOne(@Param('id') id: string): Promise<AddressResponseDto> {
    return this.addressesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '更新地址',
    description: '更新地址基础信息，也可同时调整是否默认。',
  })
  @ApiParam({ name: 'id', description: '地址 ID。' })
  @ApiBody({ type: UpdateAddressDto })
  @ApiOkResponse({
    description: '更新成功。',
    type: AddressResponseDto,
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
  ): Promise<AddressResponseDto> {
    return this.addressesService.update(id, dto);
  }

  @Patch(':id/default')
  @ApiOperation({
    summary: '设为默认地址',
    description: '将当前地址设为默认地址，并自动清除该用户其他默认标记。',
  })
  @ApiParam({ name: 'id', description: '地址 ID。' })
  @ApiBody({ type: SetDefaultAddressDto })
  @ApiOkResponse({
    description: '设置成功。',
    type: AddressResponseDto,
  })
  setDefault(
    @Param('id') id: string,
    @Body() dto: SetDefaultAddressDto,
  ): Promise<AddressResponseDto> {
    return this.addressesService.setDefault(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: '删除地址',
    description: '仅当地址未被家长档案或订单引用时可删除。',
  })
  @ApiParam({ name: 'id', description: '地址 ID。' })
  @ApiOkResponse({
    description: '删除成功。',
    type: DeleteAddressResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: '地址已被引用，无法直接删除。',
  })
  remove(@Param('id') id: string): Promise<DeleteAddressResponseDto> {
    return this.addressesService.remove(id);
  }
}
