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
  ApiExcludeEndpoint,
  ApiBearerAuth,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PlatformRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { RequireCapability } from '../common/require-capability.decorator';
import { RequireRoles } from '../auth/require-roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { JwtAuthGuard } from '../auth/supabase-auth.guard';
import { AcceptBookingDto } from './dto/accept-booking.dto';
import { ArriveBookingDto } from './dto/arrive-booking.dto';
import { BookingHoldResponseDto } from './dto/booking-hold-response.dto';
import {
  BookingListResponseDto,
  BookingResponseDto,
  DeleteBookingResponseDto,
} from './dto/booking-response.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { CompleteBookingDto } from './dto/complete-booking.dto';
import { ConfirmBookingDto } from './dto/confirm-booking.dto';
import { CreateBookingDisputeDto } from './dto/create-booking-dispute.dto';
import { CreateBookingFromHoldDto } from './dto/create-booking-from-hold.dto';
import { CreateBookingHoldDto } from './dto/create-booking-hold.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateRescheduleRequestDto } from './dto/create-reschedule-request.dto';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';
import { ListMyBookingsQueryDto } from './dto/list-my-bookings-query.dto';
import { ManualRepairBookingDto } from './dto/manual-repair-booking.dto';
import { RespondBookingDto } from './dto/respond-booking.dto';
import { RespondRescheduleRequestDto } from './dto/respond-reschedule-request.dto';
import { ResolveBookingDisputeDto } from './dto/resolve-booking-dispute.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { BookingsService } from './bookings.service';

@ApiTags('预约管理')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post('/from-hold')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireCapability('bookingCreate')
  @RequireRoles(PlatformRole.GUARDIAN)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: '家长从占位创建预约',
    description: '消费有效 booking hold，正式生成预约单。',
  })
  @ApiBody({ type: CreateBookingFromHoldDto })
  @ApiOkResponse({ type: BookingResponseDto })
  createFromHold(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Body() dto: CreateBookingFromHoldDto,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.createFromHold(currentUser, dto);
  }

  @Post('/holds')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireCapability('bookingHold')
  @RequireRoles(PlatformRole.GUARDIAN)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: '家长创建预约占位',
    description: '正式下单前先锁定时段，默认保留 5 分钟。',
  })
  @ApiBody({ type: CreateBookingHoldDto })
  @ApiOkResponse({ type: BookingHoldResponseDto })
  createHold(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Body() dto: CreateBookingHoldDto,
  ): Promise<BookingHoldResponseDto> {
    return this.bookingsService.createHold(currentUser, dto);
  }

  // @post-mvp: 后台订单管理保留实现，但 V1 默认关闭。
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireCapability('bookingAdmin')
  @RequireRoles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
  @ApiExcludeEndpoint()
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: '创建预约',
    description:
      '创建新的预约单，服务端会自动校验老师/学生关系、计算价格并生成预约单号。',
  })
  @ApiBody({ type: CreateBookingDto })
  @ApiResponse({
    status: 201,
    description: '创建成功。',
    type: BookingResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: '时间冲突、老师未开通科目、地址与家长不匹配等业务校验失败。',
  })
  create(@Body() dto: CreateBookingDto): Promise<BookingResponseDto> {
    return this.bookingsService.create(dto);
  }

  // @post-mvp: 后台订单管理保留实现，但 V1 默认关闭。
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireCapability('bookingAdmin')
  @RequireRoles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
  @ApiExcludeEndpoint()
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: '分页查询预约列表',
    description: '支持按老师、学生、家长、状态、支付状态、时间范围等条件筛选。',
  })
  @ApiQuery({ type: ListBookingsQueryDto })
  @ApiOkResponse({
    description: '查询成功。',
    type: BookingListResponseDto,
  })
  findAll(
    @Query() query: ListBookingsQueryDto,
  ): Promise<BookingListResponseDto> {
    return this.bookingsService.findAll(query);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireCapability('bookingMine')
  @RequireRoles(PlatformRole.GUARDIAN)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: '家长查询自己的预约列表',
    description: '家长端订单列表专用接口。',
  })
  @ApiQuery({ type: ListMyBookingsQueryDto })
  @ApiOkResponse({ type: BookingListResponseDto })
  findMine(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Query() query: ListMyBookingsQueryDto,
  ): Promise<BookingListResponseDto> {
    return this.bookingsService.findMine(currentUser, query);
  }

  @Get('mine/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireCapability('bookingMine')
  @RequireRoles(PlatformRole.GUARDIAN)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: '家长查询自己的预约详情',
    description: '自动限制为当前登录家长自己的预约范围。',
  })
  @ApiOkResponse({ type: BookingResponseDto })
  findMineOne(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Param('id') id: string,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.findMineOne(currentUser, id);
  }

  // @post-mvp: 后台订单管理保留实现，但 V1 默认关闭。
  @Get('booking-no/:bookingNo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireCapability('bookingAdmin')
  @RequireRoles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
  @ApiExcludeEndpoint()
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: '按预约单号查询详情',
    description: '客服、财务或运营按预约单号排查时常用。',
  })
  @ApiParam({ name: 'bookingNo', description: '预约单号。' })
  @ApiOkResponse({
    description: '查询成功。',
    type: BookingResponseDto,
  })
  @ApiNotFoundResponse({ description: '未找到对应预约单。' })
  findByBookingNo(
    @Param('bookingNo') bookingNo: string,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.findByBookingNo(bookingNo);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireCapability('bookingMine')
  @RequireRoles(
    PlatformRole.TEACHER,
    PlatformRole.GUARDIAN,
    PlatformRole.ADMIN,
    PlatformRole.SUPER_ADMIN,
  )
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: '查询预约详情',
    description: '根据预约 ID 查询完整预约信息。',
  })
  @ApiParam({ name: 'id', description: '预约 ID。' })
  @ApiOkResponse({
    description: '查询成功。',
    type: BookingResponseDto,
  })
  @ApiNotFoundResponse({ description: '未找到对应预约。' })
  findOne(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Param('id') id: string,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.findOne(currentUser, id);
  }

  // @post-mvp: 后台订单管理保留实现，但 V1 默认关闭。
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireCapability('bookingAdmin')
  @RequireRoles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
  @ApiExcludeEndpoint()
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: '更新预约',
    description: '更新预约基础信息，服务端会自动重新校验并重新计算价格。',
  })
  @ApiParam({ name: 'id', description: '预约 ID。' })
  @ApiBody({ type: UpdateBookingDto })
  @ApiOkResponse({
    description: '更新成功。',
    type: BookingResponseDto,
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBookingDto,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.update(id, dto);
  }

  // @post-mvp: 老师拒单/统一响应在 V1 默认关闭，仅保留 accept。
  @Patch(':id/respond')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireCapability('teacherRespond')
  @RequireRoles(PlatformRole.TEACHER)
  @ApiExcludeEndpoint()
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: '老师统一响应预约',
    description: '支持接单或拒单。',
  })
  @ApiBody({ type: RespondBookingDto })
  @ApiOkResponse({ type: BookingResponseDto })
  respond(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Param('id') id: string,
    @Body() dto: RespondBookingDto,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.respond(currentUser, id, dto);
  }

  @Patch(':id/accept')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireCapability('teacherAccept')
  @RequireRoles(PlatformRole.TEACHER)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: '老师接单',
    description: '老师确认接单后，预约状态会推进到待支付。',
  })
  @ApiParam({ name: 'id', description: '预约 ID。' })
  @ApiBody({ type: AcceptBookingDto })
  @ApiOkResponse({
    description: '接单成功。',
    type: BookingResponseDto,
  })
  accept(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Param('id') id: string,
    @Body() dto: AcceptBookingDto,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.accept(currentUser, id, dto);
  }

  // @post-mvp: 家长确认课前安排在 V1 默认关闭。
  @Patch(':id/guardian-confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireCapability('guardianConfirm')
  @RequireRoles(PlatformRole.GUARDIAN)
  @ApiExcludeEndpoint()
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: '家长确认预约',
    description: '家长确认课前安排后写入确认时间，可补充最终计划摘要。',
  })
  @ApiParam({ name: 'id', description: '预约 ID。' })
  @ApiBody({ type: ConfirmBookingDto })
  @ApiOkResponse({
    description: '确认成功。',
    type: BookingResponseDto,
  })
  guardianConfirm(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Param('id') id: string,
    @Body() dto: ConfirmBookingDto,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.guardianConfirm(currentUser, id, dto);
  }

  // @post-mvp: 取消订单在 V1 默认关闭。
  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireCapability('cancelBooking')
  @RequireRoles(PlatformRole.GUARDIAN, PlatformRole.TEACHER)
  @ApiExcludeEndpoint()
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: '取消预约',
    description: '取消后会记录取消原因、取消时间和操作人。',
  })
  @ApiParam({ name: 'id', description: '预约 ID。' })
  @ApiBody({ type: CancelBookingDto })
  @ApiOkResponse({
    description: '取消成功。',
    type: BookingResponseDto,
  })
  cancel(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.cancel(id, dto, currentUser);
  }

  // @post-mvp: 改约在 V1 默认关闭。
  @Post(':id/reschedule')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireCapability('reschedule')
  @RequireRoles(PlatformRole.GUARDIAN, PlatformRole.TEACHER)
  @ApiExcludeEndpoint()
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: '发起改约请求',
    description: '家长和老师都可以对进行中的预约发起改约。',
  })
  @ApiBody({ type: CreateRescheduleRequestDto })
  @ApiOkResponse({ type: BookingResponseDto })
  createRescheduleRequest(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Param('id') id: string,
    @Body() dto: CreateRescheduleRequestDto,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.createRescheduleRequest(currentUser, id, dto);
  }

  // @post-mvp: 改约在 V1 默认关闭。
  @Patch(':id/reschedule/:requestId/respond')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireCapability('reschedule')
  @RequireRoles(PlatformRole.GUARDIAN, PlatformRole.TEACHER)
  @ApiExcludeEndpoint()
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: '响应改约请求',
    description: '被动方接受或拒绝改约。',
  })
  @ApiBody({ type: RespondRescheduleRequestDto })
  @ApiOkResponse({ type: BookingResponseDto })
  respondRescheduleRequest(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @Body() dto: RespondRescheduleRequestDto,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.respondRescheduleRequest(
      currentUser,
      id,
      requestId,
      dto,
    );
  }

  // @post-mvp: 到达确认在 V1 默认关闭。
  @Post(':id/arrival')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireCapability('arrival')
  @RequireRoles(
    PlatformRole.TEACHER,
    PlatformRole.ADMIN,
    PlatformRole.SUPER_ADMIN,
  )
  @ApiExcludeEndpoint()
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: '老师确认到达',
    description:
      '老师到达服务地址附近后确认到达，先记录时间与备注，不强制做定位校验。',
  })
  @ApiBody({ type: ArriveBookingDto })
  @ApiOkResponse({ type: BookingResponseDto })
  confirmArrival(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Param('id') id: string,
    @Body() dto: ArriveBookingDto,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.confirmArrival(currentUser, id, dto);
  }

  // @post-mvp: 完课确认在 V1 默认关闭。
  @Post(':id/complete-confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireCapability('completionConfirm')
  @RequireRoles(
    PlatformRole.GUARDIAN,
    PlatformRole.ADMIN,
    PlatformRole.SUPER_ADMIN,
  )
  @ApiExcludeEndpoint()
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: '家长确认完课',
    description: '老师签退并提交课后记录后，家长可以确认本节课已正常完成。',
  })
  @ApiBody({ type: CompleteBookingDto })
  @ApiOkResponse({ type: BookingResponseDto })
  confirmCompletion(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Param('id') id: string,
    @Body() dto: CompleteBookingDto,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.confirmCompletion(currentUser, id, dto);
  }

  // @post-mvp: 争议处理在 V1 默认关闭。
  @Post(':id/disputes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireCapability('dispute')
  @RequireRoles(
    PlatformRole.GUARDIAN,
    PlatformRole.ADMIN,
    PlatformRole.SUPER_ADMIN,
  )
  @ApiExcludeEndpoint()
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: '发起订单争议',
    description: '用于处理未上课、到场争议、时长不足、效果问题等异常情况。',
  })
  @ApiBody({ type: CreateBookingDisputeDto })
  @ApiOkResponse({ type: BookingResponseDto })
  createDispute(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Param('id') id: string,
    @Body() dto: CreateBookingDisputeDto,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.createDispute(currentUser, id, dto);
  }

  // @post-mvp: 争议处理在 V1 默认关闭。
  @Post(':id/disputes/:caseId/resolve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireCapability('dispute')
  @RequireRoles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
  @ApiExcludeEndpoint()
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: '处理订单争议',
    description: '后台管理员确认责任方、写入处理结论，并决定是否恢复结算资格。',
  })
  @ApiBody({ type: ResolveBookingDisputeDto })
  @ApiOkResponse({ type: BookingResponseDto })
  resolveDispute(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Param('id') id: string,
    @Param('caseId') caseId: string,
    @Body() dto: ResolveBookingDisputeDto,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.resolveDispute(currentUser, id, caseId, dto);
  }

  // @post-mvp: 人工修复在 V1 默认关闭。
  @Post(':id/ops/manual-repair')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireCapability('manualRepair')
  @RequireRoles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
  @ApiExcludeEndpoint()
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: '后台人工修复订单',
    description:
      '用于人工补支付、补签到签退、改责任方、关闭异常工单、修正完课状态等操作。',
  })
  @ApiBody({ type: ManualRepairBookingDto })
  @ApiOkResponse({ type: BookingResponseDto })
  manualRepair(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Param('id') id: string,
    @Body() dto: ManualRepairBookingDto,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.manualRepair(currentUser, id, dto);
  }

  // @post-mvp: 后台订单管理保留实现，但 V1 默认关闭。
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireCapability('bookingAdmin')
  @RequireRoles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
  @ApiExcludeEndpoint()
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: '删除预约',
    description: '通常仅用于清理草稿或异常测试数据，已履约订单不建议删除。',
  })
  @ApiParam({ name: 'id', description: '预约 ID。' })
  @ApiOkResponse({
    description: '删除成功。',
    type: DeleteBookingResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: '预约状态不允许删除，或存在关联数据无法删除。',
  })
  remove(@Param('id') id: string): Promise<DeleteBookingResponseDto> {
    return this.bookingsService.remove(id);
  }
}
