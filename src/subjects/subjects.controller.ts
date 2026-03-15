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
import { CreateSubjectDto } from './dto/create-subject.dto';
import { ListSubjectsQueryDto } from './dto/list-subjects-query.dto';
import { UpdateSubjectStatusDto } from './dto/update-subject-status.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import {
  DeleteSubjectResponseDto,
  SubjectListResponseDto,
  SubjectResponseDto,
} from './dto/subject-response.dto';
import { SubjectsService } from './subjects.service';

@ApiTags('科目管理')
@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Post()
  @ApiOperation({
    summary: '创建科目',
    description: '创建新的授课科目，适用于后台初始化课程品类。',
  })
  @ApiBody({ type: CreateSubjectDto })
  @ApiResponse({
    status: 201,
    description: '创建成功，返回科目详情。',
    type: SubjectResponseDto,
  })
  @ApiResponse({ status: 409, description: '科目编码已存在。' })
  create(@Body() dto: CreateSubjectDto): Promise<SubjectResponseDto> {
    return this.subjectsService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: '分页查询科目列表',
    description: '支持按关键字、启用状态进行筛选，适合后台管理页使用。',
  })
  @ApiQuery({ type: ListSubjectsQueryDto })
  @ApiOkResponse({
    description: '查询成功，返回分页结果。',
    type: SubjectListResponseDto,
  })
  findAll(
    @Query() query: ListSubjectsQueryDto,
  ): Promise<SubjectListResponseDto> {
    return this.subjectsService.findAll(query);
  }

  @Get('active')
  @ApiOperation({
    summary: '查询启用中的科目',
    description: '前台选课场景常用接口，只返回当前启用的科目。',
  })
  @ApiOkResponse({
    description: '查询成功，返回启用科目列表。',
    type: SubjectResponseDto,
    isArray: true,
  })
  findActive(): Promise<SubjectResponseDto[]> {
    return this.subjectsService.findActive();
  }

  @Get('code/:code')
  @ApiOperation({
    summary: '按科目编码查询',
    description: '后续在配置联动、导入导出、枚举映射时会比较常用。',
  })
  @ApiParam({ name: 'code', description: '科目编码，例如 PIANO。' })
  @ApiOkResponse({
    description: '查询成功，返回科目详情。',
    type: SubjectResponseDto,
  })
  @ApiNotFoundResponse({ description: '未找到对应科目编码。' })
  findByCode(@Param('code') code: string): Promise<SubjectResponseDto> {
    return this.subjectsService.findByCode(code);
  }

  @Get(':id')
  @ApiOperation({
    summary: '查询科目详情',
    description: '根据科目 ID 获取详情。',
  })
  @ApiParam({ name: 'id', description: '科目 ID。' })
  @ApiOkResponse({
    description: '查询成功，返回科目详情。',
    type: SubjectResponseDto,
  })
  @ApiNotFoundResponse({ description: '未找到对应科目。' })
  findOne(@Param('id') id: string): Promise<SubjectResponseDto> {
    return this.subjectsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '更新科目',
    description: '更新科目名称、编码、描述或启用状态。',
  })
  @ApiParam({ name: 'id', description: '科目 ID。' })
  @ApiBody({ type: UpdateSubjectDto })
  @ApiOkResponse({
    description: '更新成功，返回最新科目详情。',
    type: SubjectResponseDto,
  })
  @ApiNotFoundResponse({ description: '未找到对应科目。' })
  @ApiResponse({ status: 409, description: '新的科目编码已存在。' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSubjectDto,
  ): Promise<SubjectResponseDto> {
    return this.subjectsService.update(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: '切换科目启用状态',
    description: '用于后台快速启用或停用科目，而不修改其他字段。',
  })
  @ApiParam({ name: 'id', description: '科目 ID。' })
  @ApiBody({ type: UpdateSubjectStatusDto })
  @ApiOkResponse({
    description: '状态更新成功，返回最新科目详情。',
    type: SubjectResponseDto,
  })
  @ApiNotFoundResponse({ description: '未找到对应科目。' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSubjectStatusDto,
  ): Promise<SubjectResponseDto> {
    return this.subjectsService.updateStatus(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: '删除科目',
    description: '仅当科目未被老师资料或订单引用时可删除，否则建议改为停用。',
  })
  @ApiParam({ name: 'id', description: '科目 ID。' })
  @ApiOkResponse({
    description: '删除成功。',
    type: DeleteSubjectResponseDto,
  })
  @ApiNotFoundResponse({ description: '未找到对应科目。' })
  @ApiResponse({
    status: 400,
    description: '科目已被引用，不能直接删除。',
  })
  remove(@Param('id') id: string): Promise<DeleteSubjectResponseDto> {
    return this.subjectsService.remove(id);
  }
}
