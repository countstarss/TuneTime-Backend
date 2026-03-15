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
import { CreateTeacherReviewDto } from './dto/create-teacher-review.dto';
import { ListTeacherReviewsQueryDto } from './dto/list-teacher-reviews-query.dto';
import {
  DeleteTeacherReviewResponseDto,
  TeacherReviewListResponseDto,
  TeacherReviewResponseDto,
  TeacherReviewSummaryResponseDto,
} from './dto/teacher-review-response.dto';
import { UpdateTeacherReviewDto } from './dto/update-teacher-review.dto';
import { TeacherReviewsService } from './teacher-reviews.service';

@ApiTags('老师评价')
@Controller('teacher-reviews')
export class TeacherReviewsController {
  constructor(private readonly teacherReviewsService: TeacherReviewsService) {}

  @Post()
  @ApiOperation({
    summary: '创建老师评价',
    description: '根据已完成预约创建老师评价，服务端会自动同步老师评分统计。',
  })
  @ApiBody({ type: CreateTeacherReviewDto })
  @ApiResponse({
    status: 201,
    description: '创建成功。',
    type: TeacherReviewResponseDto,
  })
  @ApiResponse({ status: 409, description: '该预约已经存在老师评价。' })
  create(
    @Body() dto: CreateTeacherReviewDto,
  ): Promise<TeacherReviewResponseDto> {
    return this.teacherReviewsService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: '分页查询老师评价列表',
    description: '支持按预约、老师、学生、家长和关键字筛选。',
  })
  @ApiQuery({ type: ListTeacherReviewsQueryDto })
  @ApiOkResponse({
    description: '查询成功。',
    type: TeacherReviewListResponseDto,
  })
  findAll(
    @Query() query: ListTeacherReviewsQueryDto,
  ): Promise<TeacherReviewListResponseDto> {
    return this.teacherReviewsService.findAll(query);
  }

  @Get('booking/:bookingId')
  @ApiOperation({
    summary: '按预约查询评价',
    description: '预约详情页查看评价时常用。',
  })
  @ApiParam({ name: 'bookingId', description: '预约 ID。' })
  @ApiOkResponse({
    description: '查询成功。',
    type: TeacherReviewResponseDto,
  })
  @ApiNotFoundResponse({ description: '未找到对应评价。' })
  findByBookingId(
    @Param('bookingId') bookingId: string,
  ): Promise<TeacherReviewResponseDto> {
    return this.teacherReviewsService.findByBookingId(bookingId);
  }

  @Get('teacher/:teacherProfileId/summary')
  @ApiOperation({
    summary: '查询老师评价汇总',
    description: '老师详情页展示评分概况时使用。',
  })
  @ApiParam({ name: 'teacherProfileId', description: '老师档案 ID。' })
  @ApiOkResponse({
    description: '查询成功。',
    type: TeacherReviewSummaryResponseDto,
  })
  getTeacherSummary(
    @Param('teacherProfileId') teacherProfileId: string,
  ): Promise<TeacherReviewSummaryResponseDto> {
    return this.teacherReviewsService.getTeacherSummary(teacherProfileId);
  }

  @Get(':id')
  @ApiOperation({
    summary: '查询评价详情',
    description: '根据评价 ID 查询详情。',
  })
  @ApiParam({ name: 'id', description: '评价 ID。' })
  @ApiOkResponse({
    description: '查询成功。',
    type: TeacherReviewResponseDto,
  })
  @ApiNotFoundResponse({ description: '未找到对应评价。' })
  findOne(@Param('id') id: string): Promise<TeacherReviewResponseDto> {
    return this.teacherReviewsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '更新老师评价',
    description: '更新评分、标签或评论内容，并自动同步老师评分统计。',
  })
  @ApiParam({ name: 'id', description: '评价 ID。' })
  @ApiBody({ type: UpdateTeacherReviewDto })
  @ApiOkResponse({
    description: '更新成功。',
    type: TeacherReviewResponseDto,
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTeacherReviewDto,
  ): Promise<TeacherReviewResponseDto> {
    return this.teacherReviewsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: '删除老师评价',
    description: '删除后会自动重算老师的平均分和评价数量。',
  })
  @ApiParam({ name: 'id', description: '评价 ID。' })
  @ApiOkResponse({
    description: '删除成功。',
    type: DeleteTeacherReviewResponseDto,
  })
  remove(@Param('id') id: string): Promise<DeleteTeacherReviewResponseDto> {
    return this.teacherReviewsService.remove(id);
  }
}
