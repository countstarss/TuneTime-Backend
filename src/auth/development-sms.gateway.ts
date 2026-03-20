import { SmsGateway, SmsVerificationPayload } from './sms-gateway.interface';

export class DevelopmentSmsGateway extends SmsGateway {
  async sendVerificationCode(payload: SmsVerificationPayload): Promise<void> {
    console.info(
      `[sms:dev] send ${payload.purpose} code ${payload.code} to ${payload.phone} (ttl=${payload.ttlSeconds}s)`,
    );
  }
}
