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
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UseGuards } from '@nestjs/common';
import { PlatformRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { RequireRoles } from '../auth/require-roles.decorator';
import { CreateGuardianDto } from './dto/create-guardian.dto';
import {
  DeleteGuardianResponseDto,
  GuardianListResponseDto,
  GuardianResponseDto,
  GuardianStudentSummaryDto,
} from './dto/guardian-response.dto';
import { ListGuardiansQueryDto } from './dto/list-guardians-query.dto';
import { SetGuardianDefaultAddressDto } from './dto/set-default-address.dto';
import { UpdateGuardianDto } from './dto/update-guardian.dto';
import { GuardiansService } from './guardians.service';

@ApiTags('家长管理')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireRoles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
@Controller('guardians')
export class GuardiansController {
  constructor(private readonly guardiansService: GuardiansService) {}

  @Post()
  @ApiOperation({
    summary: '创建家长档案',
    description: '为已存在的用户创建家长资料，可附带默认服务地址。',
  })
  @ApiBody({ type: CreateGuardianDto })
  @ApiResponse({
    status: 201,
    description: '创建成功。',
    type: GuardianResponseDto,
  })
  @ApiResponse({ status: 409, description: '该用户已存在家长档案。' })
  create(@Body() dto: CreateGuardianDto): Promise<GuardianResponseDto> {
    return this.guardiansService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: '分页查询家长列表',
    description: '支持按家长名称、手机号和 userId 筛选。',
  })
  @ApiQuery({ type: ListGuardiansQueryDto })
  @ApiOkResponse({
    description: '查询成功，返回分页结果。',
    type: GuardianListResponseDto,
  })
  findAll(
    @Query() query: ListGuardiansQueryDto,
  ): Promise<GuardianListResponseDto> {
    return this.guardiansService.findAll(query);
  }

  @Get('user/:userId')
  @ApiOperation({
    summary: '按 userId 查询家长档案',
    description: '登录后获取当前用户的家长档案时会频繁使用。',
  })
  @ApiParam({ name: 'userId', description: '关联用户 ID。' })
  @ApiOkResponse({
    description: '查询成功。',
    type: GuardianResponseDto,
  })
  @ApiNotFoundResponse({ description: '未找到对应家长档案。' })
  findByUserId(@Param('userId') userId: string): Promise<GuardianResponseDto> {
    return this.guardiansService.findByUserId(userId);
  }

  @Get(':id/students')
  @ApiOperation({
    summary: '查询家长名下孩子列表',
    description: '后续在家长端首页、预约下单页都可能直接使用。',
  })
  @ApiParam({ name: 'id', description: '家长档案 ID。' })
  @ApiOkResponse({
    description: '查询成功。',
    type: GuardianStudentSummaryDto,
    isArray: true,
  })
  @ApiNotFoundResponse({ description: '未找到对应家长档案。' })
  listStudents(@Param('id') id: string): Promise<GuardianStudentSummaryDto[]> {
    return this.guardiansService.listStudents(id);
  }

  @Get(':id')
  @ApiOperation({
    summary: '查询家长详情',
    description: '根据家长档案 ID 查询详情。',
  })
  @ApiParam({ name: 'id', description: '家长档案 ID。' })
  @ApiOkResponse({
    description: '查询成功。',
    type: GuardianResponseDto,
  })
  @ApiNotFoundResponse({ description: '未找到对应家长档案。' })
  findOne(@Param('id') id: string): Promise<GuardianResponseDto> {
    return this.guardiansService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '更新家长档案',
    description: '更新家长名称、联系电话、紧急联系人或默认地址等信息。',
  })
  @ApiParam({ name: 'id', description: '家长档案 ID。' })
  @ApiBody({ type: UpdateGuardianDto })
  @ApiOkResponse({
    description: '更新成功。',
    type: GuardianResponseDto,
  })
  @ApiResponse({ status: 409, description: 'userId 已被其他家长档案占用。' })
  @ApiNotFoundResponse({ description: '未找到对应家长档案。' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateGuardianDto,
  ): Promise<GuardianResponseDto> {
    return this.guardiansService.update(id, dto);
  }

  @Patch(':id/default-address')
  @ApiOperation({
    summary: '设置默认服务地址',
    description: '单独更新默认服务地址，适合设置页快速调用。',
  })
  @ApiParam({ name: 'id', description: '家长档案 ID。' })
  @ApiBody({ type: SetGuardianDefaultAddressDto })
  @ApiOkResponse({
    description: '设置成功。',
    type: GuardianResponseDto,
  })
  @ApiNotFoundResponse({ description: '家长档案或地址不存在。' })
  setDefaultAddress(
    @Param('id') id: string,
    @Body() dto: SetGuardianDefaultAddressDto,
  ): Promise<GuardianResponseDto> {
    return this.guardiansService.setDefaultAddress(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: '删除家长档案',
    description: '仅在未绑定学生、订单或评价记录时可删除。',
  })
  @ApiParam({ name: 'id', description: '家长档案 ID。' })
  @ApiOkResponse({
    description: '删除成功。',
    type: DeleteGuardianResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: '家长档案已有关联记录，不能直接删除。',
  })
  @ApiNotFoundResponse({ description: '未找到对应家长档案。' })
  remove(@Param('id') id: string): Promise<DeleteGuardianResponseDto> {
    return this.guardiansService.remove(id);
  }
}
