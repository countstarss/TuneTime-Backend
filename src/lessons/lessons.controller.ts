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
import { CheckInLessonDto } from './dto/check-in-lesson.dto';
import { CheckOutLessonDto } from './dto/check-out-lesson.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import {
  DeleteLessonResponseDto,
  LessonListResponseDto,
  LessonResponseDto,
} from './dto/lesson-response.dto';
import { ListLessonsQueryDto } from './dto/list-lessons-query.dto';
import { SubmitLessonFeedbackDto } from './dto/submit-lesson-feedback.dto';
import { UpdateLessonAttendanceDto } from './dto/update-lesson-attendance.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { LessonsService } from './lessons.service';

@ApiTags('课程履约')
@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Post()
  @ApiOperation({
    summary: '创建课程记录',
    description: '根据预约创建课程履约记录，通常在预约确认后生成。',
  })
  @ApiBody({ type: CreateLessonDto })
  @ApiResponse({
    status: 201,
    description: '创建成功。',
    type: LessonResponseDto,
  })
  @ApiResponse({ status: 409, description: '该预约已经存在课程记录。' })
  create(@Body() dto: CreateLessonDto): Promise<LessonResponseDto> {
    return this.lessonsService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: '分页查询课程列表',
    description: '支持按预约、老师、学生和出勤状态筛选。',
  })
  @ApiQuery({ type: ListLessonsQueryDto })
  @ApiOkResponse({
    description: '查询成功。',
    type: LessonListResponseDto,
  })
  findAll(@Query() query: ListLessonsQueryDto): Promise<LessonListResponseDto> {
    return this.lessonsService.findAll(query);
  }

  @Get('booking/:bookingId')
  @ApiOperation({
    summary: '按预约查询课程记录',
    description: '预约详情页查看对应课程记录时常用。',
  })
  @ApiParam({ name: 'bookingId', description: '预约 ID。' })
  @ApiOkResponse({
    description: '查询成功。',
    type: LessonResponseDto,
  })
  @ApiNotFoundResponse({ description: '未找到对应课程记录。' })
  findByBookingId(@Param('bookingId') bookingId: string): Promise<LessonResponseDto> {
    return this.lessonsService.findByBookingId(bookingId);
  }

  @Get(':id')
  @ApiOperation({
    summary: '查询课程详情',
    description: '根据课程 ID 查询履约详情。',
  })
  @ApiParam({ name: 'id', description: '课程 ID。' })
  @ApiOkResponse({
    description: '查询成功。',
    type: LessonResponseDto,
  })
  @ApiNotFoundResponse({ description: '未找到对应课程。' })
  findOne(@Param('id') id: string): Promise<LessonResponseDto> {
    return this.lessonsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '更新课程基础信息',
    description: '更新课程总结、作业、反馈等基础字段，不处理签到签退动作。',
  })
  @ApiParam({ name: 'id', description: '课程 ID。' })
  @ApiBody({ type: UpdateLessonDto })
  @ApiOkResponse({
    description: '更新成功。',
    type: LessonResponseDto,
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLessonDto,
  ): Promise<LessonResponseDto> {
    return this.lessonsService.update(id, dto);
  }

  @Patch(':id/check-in')
  @ApiOperation({
    summary: '课程签到',
    description: '老师到达后调用，自动将课程状态推进到进行中，并同步预约状态。',
  })
  @ApiParam({ name: 'id', description: '课程 ID。' })
  @ApiBody({ type: CheckInLessonDto })
  @ApiOkResponse({
    description: '签到成功。',
    type: LessonResponseDto,
  })
  checkIn(
    @Param('id') id: string,
    @Body() dto: CheckInLessonDto,
  ): Promise<LessonResponseDto> {
    return this.lessonsService.checkIn(id, dto);
  }

  @Patch(':id/check-out')
  @ApiOperation({
    summary: '课程签退',
    description: '课程结束后调用，自动将课程状态推进到已完成，并同步预约状态。',
  })
  @ApiParam({ name: 'id', description: '课程 ID。' })
  @ApiBody({ type: CheckOutLessonDto })
  @ApiOkResponse({
    description: '签退成功。',
    type: LessonResponseDto,
  })
  checkOut(
    @Param('id') id: string,
    @Body() dto: CheckOutLessonDto,
  ): Promise<LessonResponseDto> {
    return this.lessonsService.checkOut(id, dto);
  }

  @Patch(':id/attendance')
  @ApiOperation({
    summary: '手动更新课程出勤状态',
    description: '用于补录学生缺席、老师缺席、课程取消等状态。',
  })
  @ApiParam({ name: 'id', description: '课程 ID。' })
  @ApiBody({ type: UpdateLessonAttendanceDto })
  @ApiOkResponse({
    description: '出勤状态更新成功。',
    type: LessonResponseDto,
  })
  updateAttendance(
    @Param('id') id: string,
    @Body() dto: UpdateLessonAttendanceDto,
  ): Promise<LessonResponseDto> {
    return this.lessonsService.updateAttendance(id, dto);
  }

  @Patch(':id/feedback')
  @ApiOperation({
    summary: '提交课后反馈',
    description: '提交老师总结、作业、成果视频和家长反馈，自动记录反馈提交时间。',
  })
  @ApiParam({ name: 'id', description: '课程 ID。' })
  @ApiBody({ type: SubmitLessonFeedbackDto })
  @ApiOkResponse({
    description: '反馈提交成功。',
    type: LessonResponseDto,
  })
  submitFeedback(
    @Param('id') id: string,
    @Body() dto: SubmitLessonFeedbackDto,
  ): Promise<LessonResponseDto> {
    return this.lessonsService.submitFeedback(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: '删除课程记录',
    description: '仅建议删除未履约或已取消的测试数据。',
  })
  @ApiParam({ name: 'id', description: '课程 ID。' })
  @ApiOkResponse({
    description: '删除成功。',
    type: DeleteLessonResponseDto,
  })
  @ApiResponse({ status: 400, description: '课程状态不允许删除。' })
  remove(@Param('id') id: string): Promise<DeleteLessonResponseDto> {
    return this.lessonsService.remove(id);
  }
}
