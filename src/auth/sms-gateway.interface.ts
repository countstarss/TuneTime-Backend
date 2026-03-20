import { AuthCodePurpose } from '@prisma/client';

export type SmsVerificationPayload = {
  phone: string;
  code: string;
  purpose: AuthCodePurpose;
  ttlSeconds: number;
};

export abstract class SmsGateway {
  abstract sendVerificationCode(payload: SmsVerificationPayload): Promise<void>;
}
