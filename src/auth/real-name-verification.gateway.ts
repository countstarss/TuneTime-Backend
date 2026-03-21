export type CreateRealNameVerificationInput = {
  sessionId: string;
  userId: string;
  redirectUrl?: string;
};

export type CreateRealNameVerificationResult = {
  provider: string;
  status: string;
  startUrl: string | null;
  expiresAt: Date | null;
  ticket: string | null;
  mockMode: boolean;
};

export abstract class RealNameVerificationGateway {
  abstract createSession(
    input: CreateRealNameVerificationInput,
  ): Promise<CreateRealNameVerificationResult>;
}
