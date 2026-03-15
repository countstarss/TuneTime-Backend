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
import { AcceptBookingDto } from './dto/accept-booking.dto';
import {
  BookingListResponseDto,
  BookingResponseDto,
  DeleteBookingResponseDto,
} from './dto/booking-response.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { ConfirmBookingDto } from './dto/confirm-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';
import { UpdateBookingPaymentDto } from './dto/update-booking-payment.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { BookingsService } from './bookings.service';

@ApiTags('预约管理')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
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

  @Get()
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

  @Get('booking-no/:bookingNo')
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
  findOne(@Param('id') id: string): Promise<BookingResponseDto> {
    return this.bookingsService.findOne(id);
  }

  @Patch(':id')
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

  @Patch(':id/accept')
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
    @Param('id') id: string,
    @Body() dto: AcceptBookingDto,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.accept(id, dto);
  }

  @Patch(':id/guardian-confirm')
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
    @Param('id') id: string,
    @Body() dto: ConfirmBookingDto,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.guardianConfirm(id, dto);
  }

  @Patch(':id/payment')
  @ApiOperation({
    summary: '更新预约支付状态',
    description:
      '支付成功后会自动将预约状态推进到已确认；退款完成后会同步改成已退款。',
  })
  @ApiParam({ name: 'id', description: '预约 ID。' })
  @ApiBody({ type: UpdateBookingPaymentDto })
  @ApiOkResponse({
    description: '支付状态更新成功。',
    type: BookingResponseDto,
  })
  updatePayment(
    @Param('id') id: string,
    @Body() dto: UpdateBookingPaymentDto,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.updatePayment(id, dto);
  }

  @Patch(':id/cancel')
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
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.cancel(id, dto);
  }

  @Delete(':id')
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
