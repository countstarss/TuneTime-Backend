import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiExcludeController,
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
import { RequireCapability } from '../common/require-capability.decorator';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { ListTeachersQueryDto } from './dto/list-teachers-query.dto';
import {
  ReplaceTeacherAvailabilityRulesDto,
  ReplaceTeacherCredentialsDto,
  ReplaceTeacherServiceAreasDto,
  ReplaceTeacherSubjectsDto,
} from './dto/replace-teacher-resources.dto';
import {
  DeleteTeacherResponseDto,
  TeacherListResponseDto,
  TeacherResponseDto,
} from './dto/teacher-response.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { UpdateTeacherVerificationDto } from './dto/update-teacher-verification.dto';
import { TeachersService } from './teachers.service';

// @post-mvp: 后台老师管理保留实现，但 V1 默认关闭。
@ApiTags('老师管理')
@ApiExcludeController()
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireCapability('teacherAdmin')
@RequireRoles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
@Controller('teachers')
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  @Post()
  @ApiOperation({
    summary: '创建老师档案',
    description: '创建老师基础档案，主要用于入驻初始化。',
  })
  @ApiBody({ type: CreateTeacherDto })
  @ApiResponse({
    status: 201,
    description: '创建成功。',
    type: TeacherResponseDto,
  })
  @ApiResponse({ status: 409, description: '该用户已存在老师档案。' })
  create(@Body() dto: CreateTeacherDto): Promise<TeacherResponseDto> {
    return this.teachersService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: '分页查询老师列表',
    description: '支持按审核状态、雇佣类型、科目和服务区域筛选。',
  })
  @ApiQuery({ type: ListTeachersQueryDto })
  @ApiOkResponse({
    description: '查询成功。',
    type: TeacherListResponseDto,
  })
  findAll(
    @Query() query: ListTeachersQueryDto,
  ): Promise<TeacherListResponseDto> {
    return this.teachersService.findAll(query);
  }

  @Get('verified')
  @ApiOperation({
    summary: '查询已审核通过老师',
    description: '前台选老师时的常用接口，只返回审核通过的老师。',
  })
  @ApiOkResponse({
    description: '查询成功。',
    type: TeacherResponseDto,
    isArray: true,
  })
  findVerified(): Promise<TeacherResponseDto[]> {
    return this.teachersService.findVerified();
  }

  @Get('user/:userId')
  @ApiOperation({
    summary: '按 userId 查询老师档案',
    description: '老师端登录后查询自己的档案时可直接使用。',
  })
  @ApiParam({ name: 'userId', description: '关联用户 ID。' })
  @ApiOkResponse({
    description: '查询成功。',
    type: TeacherResponseDto,
  })
  @ApiNotFoundResponse({ description: '未找到对应老师档案。' })
  findByUserId(@Param('userId') userId: string): Promise<TeacherResponseDto> {
    return this.teachersService.findByUserId(userId);
  }

  @Get(':id')
  @ApiOperation({
    summary: '查询老师详情',
    description: '返回老师档案及其科目、服务区域、可预约规则、资质材料。',
  })
  @ApiParam({ name: 'id', description: '老师档案 ID。' })
  @ApiOkResponse({
    description: '查询成功。',
    type: TeacherResponseDto,
  })
  @ApiNotFoundResponse({ description: '未找到对应老师档案。' })
  findOne(@Param('id') id: string): Promise<TeacherResponseDto> {
    return this.teachersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '更新老师档案',
    description: '更新老师基础信息，不包含科目、区域、规则、资质等子资源。',
  })
  @ApiParam({ name: 'id', description: '老师档案 ID。' })
  @ApiBody({ type: UpdateTeacherDto })
  @ApiOkResponse({
    description: '更新成功。',
    type: TeacherResponseDto,
  })
  @ApiResponse({ status: 409, description: 'userId 已被其他老师档案占用。' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTeacherDto,
  ): Promise<TeacherResponseDto> {
    return this.teachersService.update(id, dto);
  }

  @Patch(':id/verification')
  @ApiOperation({
    summary: '更新老师审核状态',
    description: '后台审核老师时使用，可同步写入面试备注。',
  })
  @ApiParam({ name: 'id', description: '老师档案 ID。' })
  @ApiBody({ type: UpdateTeacherVerificationDto })
  @ApiOkResponse({
    description: '审核状态更新成功。',
    type: TeacherResponseDto,
  })
  updateVerification(
    @Param('id') id: string,
    @Body() dto: UpdateTeacherVerificationDto,
  ): Promise<TeacherResponseDto> {
    return this.teachersService.updateVerification(id, dto);
  }

  @Put(':id/subjects')
  @ApiOperation({
    summary: '整体替换老师科目配置',
    description: '会整体覆盖当前老师的科目和课时费配置。',
  })
  @ApiParam({ name: 'id', description: '老师档案 ID。' })
  @ApiBody({ type: ReplaceTeacherSubjectsDto })
  @ApiOkResponse({
    description: '替换成功。',
    type: TeacherResponseDto,
  })
  replaceSubjects(
    @Param('id') id: string,
    @Body() dto: ReplaceTeacherSubjectsDto,
  ): Promise<TeacherResponseDto> {
    return this.teachersService.replaceSubjects(id, dto);
  }

  @Put(':id/service-areas')
  @ApiOperation({
    summary: '整体替换服务区域',
    description: '会整体覆盖当前老师的服务区域配置。',
  })
  @ApiParam({ name: 'id', description: '老师档案 ID。' })
  @ApiBody({ type: ReplaceTeacherServiceAreasDto })
  @ApiOkResponse({
    description: '替换成功。',
    type: TeacherResponseDto,
  })
  replaceServiceAreas(
    @Param('id') id: string,
    @Body() dto: ReplaceTeacherServiceAreasDto,
  ): Promise<TeacherResponseDto> {
    return this.teachersService.replaceServiceAreas(id, dto);
  }

  @Put(':id/availability-rules')
  @ApiOperation({
    summary: '整体替换可预约规则',
    description: '会整体覆盖当前老师的固定可预约时间规则。',
  })
  @ApiParam({ name: 'id', description: '老师档案 ID。' })
  @ApiBody({ type: ReplaceTeacherAvailabilityRulesDto })
  @ApiOkResponse({
    description: '替换成功。',
    type: TeacherResponseDto,
  })
  replaceAvailabilityRules(
    @Param('id') id: string,
    @Body() dto: ReplaceTeacherAvailabilityRulesDto,
  ): Promise<TeacherResponseDto> {
    return this.teachersService.replaceAvailabilityRules(id, dto);
  }

  @Put(':id/credentials')
  @ApiOperation({
    summary: '整体替换老师资质材料',
    description: '会整体覆盖当前老师的资质材料列表。',
  })
  @ApiParam({ name: 'id', description: '老师档案 ID。' })
  @ApiBody({ type: ReplaceTeacherCredentialsDto })
  @ApiOkResponse({
    description: '替换成功。',
    type: TeacherResponseDto,
  })
  replaceCredentials(
    @Param('id') id: string,
    @Body() dto: ReplaceTeacherCredentialsDto,
  ): Promise<TeacherResponseDto> {
    return this.teachersService.replaceCredentials(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: '删除老师档案',
    description: '仅当老师未关联订单、课程、评价等业务记录时可删除。',
  })
  @ApiParam({ name: 'id', description: '老师档案 ID。' })
  @ApiOkResponse({
    description: '删除成功。',
    type: DeleteTeacherResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: '老师档案已有业务关联，不能直接删除。',
  })
  remove(@Param('id') id: string): Promise<DeleteTeacherResponseDto> {
    return this.teachersService.remove(id);
  }
}
