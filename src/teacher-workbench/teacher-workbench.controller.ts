import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
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
import { RequireCapability } from '../common/require-capability.decorator';
import { ListTeacherPendingBookingsQueryDto } from './dto/list-teacher-pending-bookings-query.dto';
import {
  TeacherWorkbenchBookingDetailDto,
  TeacherWorkbenchPendingBookingListResponseDto,
} from './dto/teacher-workbench-response.dto';
import { TeacherWorkbenchService } from './teacher-workbench.service';

@ApiTags('老师工作台')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireRoles(PlatformRole.TEACHER)
@RequireCapability('teacherWorkbench')
@Controller('teacher-workbench')
export class TeacherWorkbenchController {
  constructor(
    private readonly teacherWorkbenchService: TeacherWorkbenchService,
  ) {}

  @Get('bookings/pending')
  @ApiOperation({
    summary: '老师工作台待处理预约列表',
    description: '老师端工作台专用列表，只返回待接单、待支付、已确认三类预约。',
  })
  @ApiQuery({ type: ListTeacherPendingBookingsQueryDto })
  @ApiOkResponse({ type: TeacherWorkbenchPendingBookingListResponseDto })
  listPendingBookings(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Query() query: ListTeacherPendingBookingsQueryDto,
  ): Promise<TeacherWorkbenchPendingBookingListResponseDto> {
    return this.teacherWorkbenchService.listPendingBookings(currentUser, query);
  }

  @Get('bookings/pending/:id')
  @ApiOperation({
    summary: '老师工作台预约详情',
    description: '读取待处理预约详情，自动限制为当前登录老师自己的预约范围。',
  })
  @ApiParam({ name: 'id', description: '预约 ID。' })
  @ApiOkResponse({ type: TeacherWorkbenchBookingDetailDto })
  @ApiNotFoundResponse({ description: '未找到对应预约，或不在待处理范围内。' })
  findPendingBookingDetail(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Param('id') id: string,
  ): Promise<TeacherWorkbenchBookingDetailDto> {
    return this.teacherWorkbenchService.findPendingBookingDetail(
      currentUser,
      id,
    );
  }
}
