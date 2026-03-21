import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  MockPaymentRequestDto,
  QaScenarioResetResponseDto,
  QaScenarioResponseDto,
} from './dto/test-support.dto';
import { TestSupportService } from './test-support.service';

@ApiTags('测试支持')
@Controller('test-support')
export class TestSupportController {
  constructor(private readonly testSupportService: TestSupportService) {}

  @Get('qa-scenario')
  @ApiOperation({ summary: '读取 Task 0 QA 场景、测试账号与事件日志' })
  @ApiOkResponse({ type: QaScenarioResponseDto })
  getQaScenario(): Promise<QaScenarioResponseDto> {
    return this.testSupportService.getQaScenario();
  }

  @Post('qa-scenario/reset')
  @ApiOperation({ summary: '重置 Task 0 QA 场景到固定初始状态' })
  @ApiOkResponse({ type: QaScenarioResetResponseDto })
  resetQaScenario(): Promise<QaScenarioResetResponseDto> {
    return this.testSupportService.resetQaScenario();
  }

  @Post('qa-scenario/mock-payment')
  @ApiOperation({ summary: '对指定预约触发开发态模拟支付成功/失败' })
  @ApiOkResponse({ type: QaScenarioResponseDto })
  mockPayment(
    @Body() dto: MockPaymentRequestDto,
  ): Promise<QaScenarioResponseDto> {
    return this.testSupportService.mockPayment(dto);
  }
}
