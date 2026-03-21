import { ServiceUnavailableException } from '@nestjs/common';
import {
  CreateRealNameVerificationInput,
  CreateRealNameVerificationResult,
  RealNameVerificationGateway,
} from './real-name-verification.gateway';

// 腾讯云实人认证需要业务侧先在控制台创建 RuleId，再由服务端获取 BizToken 和核身入口 URL。
// 当前仓库先预留网关位置，待提供正式密钥和 RuleId 后再接入真实 API。
export class TencentRealNameGateway extends RealNameVerificationGateway {
  async createSession(
    _input: CreateRealNameVerificationInput,
  ): Promise<CreateRealNameVerificationResult> {
    throw new ServiceUnavailableException(
      '腾讯云实名核身尚未完成密钥与 RuleId 配置，当前环境请先使用 MOCK provider',
    );
  }
}
