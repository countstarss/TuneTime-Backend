import {
  CreateRealNameVerificationInput,
  CreateRealNameVerificationResult,
  RealNameVerificationGateway,
} from './real-name-verification.gateway';

export class DevelopmentRealNameGateway extends RealNameVerificationGateway {
  async createSession(
    input: CreateRealNameVerificationInput,
  ): Promise<CreateRealNameVerificationResult> {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    return {
      provider: 'MOCK',
      status: 'PENDING',
      startUrl: input.redirectUrl ?? null,
      expiresAt,
      ticket: `mock_${input.sessionId}`,
      mockMode: true,
    };
  }
}
