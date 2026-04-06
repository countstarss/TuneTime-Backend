import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiExcludeController,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RequireCapability } from '../common/require-capability.decorator';
import {
  MockPaymentRequestDto,
  ResetQaScenarioRequestDto,
  QaScenarioResetResponseDto,
  QaScenarioResponseDto,
} from './dto/test-support.dto';
import { TestSupportService } from './test-support.service';

// @post-mvp: QA 测试支持保留实现，但 V1 默认关闭。
@ApiTags('测试支持')
@ApiExcludeController()
@RequireCapability('testSupport')
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
  @ApiOperation({ summary: '重置固定 QA 场景到指定初始状态' })
  @ApiOkResponse({ type: QaScenarioResetResponseDto })
  resetQaScenario(
    @Body() dto: ResetQaScenarioRequestDto,
  ): Promise<QaScenarioResetResponseDto> {
    return this.testSupportService.resetQaScenario(dto);
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
