import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RealNameVerificationGateway } from './real-name-verification.gateway';

@Injectable()
export class RealNameVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: RealNameVerificationGateway,
  ) {}

  async createSession(userId: string, redirectUrl?: string) {
    const prisma = this.prisma as any;
    const sessionId = randomUUID();
    const result = await this.gateway.createSession({
      sessionId,
      userId,
      redirectUrl,
    });

    await prisma.realNameVerificationSession.create({
      data: {
        id: sessionId,
        userId,
        provider: result.provider,
        status: result.status,
        startUrl: result.startUrl,
        expiresAt: result.expiresAt,
        ticket: result.ticket,
      },
    });

    return {
      sessionId,
      provider: result.provider,
      status: result.status,
      startUrl: result.startUrl,
      expiresAt: result.expiresAt,
      mockMode: result.mockMode,
    };
  }

  async completeMockSession(input: {
    userId: string;
    sessionId: string;
    fullName: string;
    idNumber: string;
  }) {
    const prisma = this.prisma as any;
    const session = await prisma.realNameVerificationSession.findUnique({
      where: { id: input.sessionId },
      select: {
        id: true,
        userId: true,
        provider: true,
        status: true,
      },
    });

    if (!session || session.userId !== input.userId) {
      throw new NotFoundException('未找到对应的实名核身会话');
    }

    if (session.provider !== 'MOCK') {
      throw new BadRequestException('当前实名核身会话不支持模拟完成');
    }

    const verifiedAt = new Date();
    const maskedIdNumber = this.maskIdNumber(input.idNumber);
    const fullName = input.fullName.trim();

    await prisma.$transaction([
      prisma.realNameVerificationSession.update({
        where: { id: input.sessionId },
        data: {
          status: 'PASSED',
          verifiedAt,
          resultPayload: {
            fullName,
            idNumberMasked: maskedIdNumber,
            verificationMode: 'MOCK',
          },
        },
      }),
      prisma.user.update({
        where: { id: input.userId },
        data: {
          realNameVerifiedAt: verifiedAt,
          realNameProvider: 'MOCK',
          realNameVerifiedName: fullName,
          realNameIdNumberMasked: maskedIdNumber,
        },
      }),
    ]);
  }

  async getVerificationSnapshot(userId: string) {
    const prisma = this.prisma as any;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        realNameVerifiedAt: true,
        realNameProvider: true,
        realNameVerifiedName: true,
        realNameIdNumberMasked: true,
      },
    });

    return {
      realNameVerifiedAt: user?.realNameVerifiedAt ?? null,
      realNameProvider: user?.realNameProvider ?? null,
      realNameVerifiedName: user?.realNameVerifiedName ?? null,
      realNameIdNumberMasked: user?.realNameIdNumberMasked ?? null,
    };
  }

  private maskIdNumber(value: string): string {
    const trimmed = value.trim();
    if (trimmed.length <= 8) {
      return trimmed;
    }

    return `${trimmed.substring(0, 4)}********${trimmed.substring(trimmed.length - 4)}`;
  }
}
