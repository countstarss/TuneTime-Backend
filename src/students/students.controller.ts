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
import { CreateStudentDto } from './dto/create-student.dto';
import { ListStudentsQueryDto } from './dto/list-students-query.dto';
import {
  DeleteStudentResponseDto,
  StudentListResponseDto,
  StudentResponseDto,
} from './dto/student-response.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { UpsertStudentGuardianDto } from './dto/upsert-student-guardian.dto';
import { StudentsService } from './students.service';

// @post-mvp: 后台学生管理保留实现，但 V1 默认关闭。
@ApiTags('学生管理')
@ApiExcludeController()
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireCapability('studentAdmin')
@RequireRoles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  @ApiOperation({
    summary: '创建学生档案',
    description: '创建学生基础资料，并可在创建时同步绑定一个或多个家长。',
  })
  @ApiBody({ type: CreateStudentDto })
  @ApiResponse({
    status: 201,
    description: '创建成功。',
    type: StudentResponseDto,
  })
  @ApiResponse({ status: 409, description: 'userId 或绑定关系重复。' })
  create(@Body() dto: CreateStudentDto): Promise<StudentResponseDto> {
    return this.studentsService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: '分页查询学生列表',
    description: '支持按关键字、年级、userId、家长 ID 过滤。',
  })
  @ApiQuery({ type: ListStudentsQueryDto })
  @ApiOkResponse({
    description: '查询成功，返回分页结果。',
    type: StudentListResponseDto,
  })
  findAll(
    @Query() query: ListStudentsQueryDto,
  ): Promise<StudentListResponseDto> {
    return this.studentsService.findAll(query);
  }

  @Get('user/:userId')
  @ApiOperation({
    summary: '按 userId 查询学生档案',
    description: '适合学生端登录后查询自己的档案。',
  })
  @ApiParam({ name: 'userId', description: '关联用户 ID。' })
  @ApiOkResponse({
    description: '查询成功。',
    type: StudentResponseDto,
  })
  @ApiNotFoundResponse({ description: '未找到对应学生档案。' })
  findByUserId(@Param('userId') userId: string): Promise<StudentResponseDto> {
    return this.studentsService.findByUserId(userId);
  }

  @Get(':id')
  @ApiOperation({
    summary: '查询学生详情',
    description: '返回学生基础资料及已绑定的家长关系。',
  })
  @ApiParam({ name: 'id', description: '学生档案 ID。' })
  @ApiOkResponse({
    description: '查询成功。',
    type: StudentResponseDto,
  })
  @ApiNotFoundResponse({ description: '未找到对应学生档案。' })
  findOne(@Param('id') id: string): Promise<StudentResponseDto> {
    return this.studentsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '更新学生档案',
    description: '更新学生资料，也可以通过 guardians 字段批量补充绑定关系。',
  })
  @ApiParam({ name: 'id', description: '学生档案 ID。' })
  @ApiBody({ type: UpdateStudentDto })
  @ApiOkResponse({
    description: '更新成功。',
    type: StudentResponseDto,
  })
  @ApiResponse({ status: 409, description: 'userId 已被其他学生档案占用。' })
  @ApiNotFoundResponse({ description: '学生或关联家长不存在。' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
  ): Promise<StudentResponseDto> {
    return this.studentsService.update(id, dto);
  }

  @Patch(':id/guardians')
  @ApiOperation({
    summary: '新增或更新学生-家长绑定',
    description:
      '适合后续设置页、关系管理页调用。若传 isPrimary=true，会将该学生其他绑定改为非主联系人。',
  })
  @ApiParam({ name: 'id', description: '学生档案 ID。' })
  @ApiBody({ type: UpsertStudentGuardianDto })
  @ApiOkResponse({
    description: '绑定成功，返回最新学生详情。',
    type: StudentResponseDto,
  })
  @ApiNotFoundResponse({ description: '学生或家长不存在。' })
  upsertGuardian(
    @Param('id') id: string,
    @Body() dto: UpsertStudentGuardianDto,
  ): Promise<StudentResponseDto> {
    return this.studentsService.upsertGuardian(id, dto);
  }

  @Delete(':id/guardians/:guardianProfileId')
  @ApiOperation({
    summary: '解除学生与家长绑定',
    description: '仅移除关系，不删除家长或学生本身。',
  })
  @ApiParam({ name: 'id', description: '学生档案 ID。' })
  @ApiParam({ name: 'guardianProfileId', description: '家长档案 ID。' })
  @ApiOkResponse({
    description: '解绑成功，返回最新学生详情。',
    type: StudentResponseDto,
  })
  @ApiNotFoundResponse({ description: '学生不存在或绑定关系不存在。' })
  removeGuardian(
    @Param('id') id: string,
    @Param('guardianProfileId') guardianProfileId: string,
  ): Promise<StudentResponseDto> {
    return this.studentsService.removeGuardian(id, guardianProfileId);
  }

  @Delete(':id')
  @ApiOperation({
    summary: '删除学生档案',
    description: '仅当学生未关联订单、课程、评价等记录时可删除。',
  })
  @ApiParam({ name: 'id', description: '学生档案 ID。' })
  @ApiOkResponse({
    description: '删除成功。',
    type: DeleteStudentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: '学生档案已有关联业务记录，不能直接删除。',
  })
  @ApiNotFoundResponse({ description: '未找到对应学生档案。' })
  remove(@Param('id') id: string): Promise<DeleteStudentResponseDto> {
    return this.studentsService.remove(id);
  }
}
