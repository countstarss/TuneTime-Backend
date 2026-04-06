import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiExcludeController,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { RequireCapability } from '../common/require-capability.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { JwtAuthGuard } from '../auth/supabase-auth.guard';
import { CalendarService } from './calendar.service';
import { CalendarQueryDto, CalendarResponseDto } from './dto/calendar.dto';

// @post-mvp: 统一课表保留实现，但 V1 默认关闭。
@ApiTags('我的课表')
@ApiExcludeController()
@Controller('calendar')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('bearer')
@RequireCapability('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('me')
  @ApiOperation({
    summary: '查询当前账号课表',
    description: '家长与老师统一入口，按 role 返回对应视图数据。',
  })
  @ApiQuery({ type: CalendarQueryDto })
  @ApiOkResponse({ type: CalendarResponseDto })
  getMyCalendar(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Query() query: CalendarQueryDto,
  ): Promise<CalendarResponseDto> {
    return this.calendarService.getMyCalendar(currentUser, query);
  }
}
