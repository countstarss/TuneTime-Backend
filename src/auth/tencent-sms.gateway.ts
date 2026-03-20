import { createHash, createHmac } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { AuthCodePurpose } from '@prisma/client';
import { SmsGateway, SmsVerificationPayload } from './sms-gateway.interface';

const SERVICE = 'sms';
const HOST = 'sms.tencentcloudapi.com';
const VERSION = '2021-01-11';
const ACTION = 'SendSms';
const REGION = process.env.TENCENT_SMS_REGION || 'ap-guangzhou';

function sha256(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function hmacSha256(key: Buffer | string, value: string) {
  return createHmac('sha256', key).update(value, 'utf8').digest();
}

function getTemplateIdByPurpose(purpose: AuthCodePurpose) {
  if (purpose === AuthCodePurpose.PHONE_BIND) {
    return process.env.TENCENT_SMS_TEMPLATE_PHONE_BIND;
  }

  return process.env.TENCENT_SMS_TEMPLATE_LOGIN;
}

export class TencentSmsGateway extends SmsGateway {
  private readonly secretId = process.env.TENCENT_SMS_SECRET_ID;

  private readonly secretKey = process.env.TENCENT_SMS_SECRET_KEY;

  private readonly sdkAppId = process.env.TENCENT_SMS_SDK_APP_ID;

  private readonly signName = process.env.TENCENT_SMS_SIGN_NAME;

  constructor() {
    super();

    if (!this.secretId || !this.secretKey || !this.sdkAppId || !this.signName) {
      throw new UnauthorizedException('Tencent SMS provider is not configured');
    }
  }

  async sendVerificationCode(payload: SmsVerificationPayload): Promise<void> {
    const templateId = getTemplateIdByPurpose(payload.purpose);

    if (!templateId) {
      throw new UnauthorizedException(
        `Missing Tencent SMS template for purpose ${payload.purpose}`,
      );
    }

    const requestTimestamp = Math.floor(Date.now() / 1000);
    const requestDate = new Date(requestTimestamp * 1000)
      .toISOString()
      .slice(0, 10);
    const body = JSON.stringify({
      SmsSdkAppId: this.sdkAppId,
      SignName: this.signName,
      TemplateId: templateId,
      TemplateParamSet: [
        payload.code,
        String(Math.ceil(payload.ttlSeconds / 60)),
      ],
      PhoneNumberSet: [`+86${payload.phone}`],
    });

    const canonicalRequest = [
      'POST',
      '/',
      '',
      `content-type:application/json; charset=utf-8\nhost:${HOST}\n`,
      'content-type;host',
      sha256(body),
    ].join('\n');

    const credentialScope = `${requestDate}/${SERVICE}/tc3_request`;
    const stringToSign = [
      'TC3-HMAC-SHA256',
      String(requestTimestamp),
      credentialScope,
      sha256(canonicalRequest),
    ].join('\n');

    const secretDate = hmacSha256(`TC3${this.secretKey}`, requestDate);
    const secretService = hmacSha256(secretDate, SERVICE);
    const secretSigning = hmacSha256(secretService, 'tc3_request');
    const signature = createHmac('sha256', secretSigning)
      .update(stringToSign, 'utf8')
      .digest('hex');

    const authorization = [
      'TC3-HMAC-SHA256',
      `Credential=${this.secretId}/${credentialScope}`,
      'SignedHeaders=content-type;host',
      `Signature=${signature}`,
    ].join(', ');

    const response = await fetch(`https://${HOST}`, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json; charset=utf-8',
        Host: HOST,
        'X-TC-Action': ACTION,
        'X-TC-Version': VERSION,
        'X-TC-Region': REGION,
        'X-TC-Timestamp': String(requestTimestamp),
      },
      body,
    });

    if (!response.ok) {
      throw new UnauthorizedException('Tencent SMS request failed');
    }

    const payloadJson = (await response.json()) as {
      Response?: { Error?: { Message?: string } };
    };

    const errorMessage = payloadJson.Response?.Error?.Message;
    if (errorMessage) {
      throw new UnauthorizedException(`Tencent SMS error: ${errorMessage}`);
    }
  }
}
