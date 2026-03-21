import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { PlatformRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequireRoles } from '../auth/require-roles.decorator';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { RolesGuard } from '../auth/roles.guard';
import { JwtAuthGuard } from '../auth/supabase-auth.guard';
import {
  AvailabilityWindowQueryDto,
  AvailabilityWindowsResponseDto,
  CreateAvailabilityBlockDto,
  CreateAvailabilityExtraSlotDto,
  DiscoverTeachersQueryDto,
  DiscoverTeachersResponseDto,
  ReplaceWeeklyRulesDto,
  SearchTeacherAvailabilityDto,
  SearchTeacherAvailabilityResponseDto,
  TeacherAvailabilityConfigResponseDto,
} from './dto/teacher-availability.dto';
import { TeacherAvailabilityService } from './teacher-availability.service';

@ApiTags('老师可接单时间')
@Controller('teacher-availability')
export class TeacherAvailabilityController {
  constructor(
    private readonly teacherAvailabilityService: TeacherAvailabilityService,
  ) {}

  @Get('teachers/:teacherProfileId/windows')
  @ApiOperation({ summary: '查询老师未来可售卖时段' })
  @ApiParam({ name: 'teacherProfileId', description: '老师档案 ID。' })
  @ApiQuery({ type: AvailabilityWindowQueryDto })
  @ApiOkResponse({ type: AvailabilityWindowsResponseDto })
  getTeacherAvailabilityWindows(
    @Param('teacherProfileId') teacherProfileId: string,
    @Query() query: AvailabilityWindowQueryDto,
  ): Promise<AvailabilityWindowsResponseDto> {
    return this.teacherAvailabilityService.getTeacherAvailabilityWindows(
      teacherProfileId,
      query,
    );
  }

  @Get('discover/teachers')
  @ApiOperation({ summary: '发现页读取真实老师列表及预览可约时段' })
  @ApiQuery({ type: DiscoverTeachersQueryDto })
  @ApiOkResponse({ type: DiscoverTeachersResponseDto })
  listDiscoverTeachers(
    @Query() query: DiscoverTeachersQueryDto,
  ): Promise<DiscoverTeachersResponseDto> {
    return this.teacherAvailabilityService.listDiscoverTeachers(query);
  }

  @Post('search')
  @ApiOperation({ summary: '按日期时间与科目搜索可接单老师' })
  @ApiOkResponse({ type: SearchTeacherAvailabilityResponseDto })
  searchTeachersByAvailability(
    @Body() dto: SearchTeacherAvailabilityDto,
  ): Promise<SearchTeacherAvailabilityResponseDto> {
    return this.teacherAvailabilityService.searchTeachersByAvailability(dto);
  }

  @Get('self/config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRoles(PlatformRole.TEACHER)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '读取老师自己的排班配置' })
  @ApiOkResponse({ type: TeacherAvailabilityConfigResponseDto })
  getSelfAvailabilityConfig(
    @CurrentUser() currentUser: AuthenticatedUserContext,
  ): Promise<TeacherAvailabilityConfigResponseDto> {
    return this.teacherAvailabilityService.getSelfAvailabilityConfig(currentUser);
  }

  @Patch('self/weekly-rules')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRoles(PlatformRole.TEACHER)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '整体替换老师自己的周模板' })
  @ApiOkResponse({ type: TeacherAvailabilityConfigResponseDto })
  replaceSelfWeeklyRules(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Body() dto: ReplaceWeeklyRulesDto,
  ): Promise<TeacherAvailabilityConfigResponseDto> {
    return this.teacherAvailabilityService.replaceSelfWeeklyRules(
      currentUser,
      dto,
    );
  }

  @Post('self/blocks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRoles(PlatformRole.TEACHER)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '老师新增不可约封锁时段' })
  @ApiOkResponse({ type: TeacherAvailabilityConfigResponseDto })
  createSelfAvailabilityBlock(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Body() dto: CreateAvailabilityBlockDto,
  ): Promise<TeacherAvailabilityConfigResponseDto> {
    return this.teacherAvailabilityService.createSelfAvailabilityBlock(
      currentUser,
      dto,
    );
  }

  @Delete('self/blocks/:blockId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRoles(PlatformRole.TEACHER)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '老师删除不可约封锁时段' })
  @ApiOkResponse({ type: TeacherAvailabilityConfigResponseDto })
  deleteSelfAvailabilityBlock(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Param('blockId') blockId: string,
  ): Promise<TeacherAvailabilityConfigResponseDto> {
    return this.teacherAvailabilityService.deleteSelfAvailabilityBlock(
      currentUser,
      blockId,
    );
  }

  @Post('self/extra-slots')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRoles(PlatformRole.TEACHER)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '老师新增单日临时开放时段' })
  @ApiOkResponse({ type: TeacherAvailabilityConfigResponseDto })
  createSelfExtraSlot(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Body() dto: CreateAvailabilityExtraSlotDto,
  ): Promise<TeacherAvailabilityConfigResponseDto> {
    return this.teacherAvailabilityService.createSelfExtraSlot(currentUser, dto);
  }

  @Delete('self/extra-slots/:ruleId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRoles(PlatformRole.TEACHER)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '老师删除单日临时开放时段' })
  @ApiOkResponse({ type: TeacherAvailabilityConfigResponseDto })
  deleteSelfExtraSlot(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Param('ruleId') ruleId: string,
  ): Promise<TeacherAvailabilityConfigResponseDto> {
    return this.teacherAvailabilityService.deleteSelfExtraSlot(currentUser, ruleId);
  }
}
