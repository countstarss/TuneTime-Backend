import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createDecipheriv,
  createHash,
  createPrivateKey,
  createPublicKey,
  createSign,
  createVerify,
  KeyObject,
  randomBytes,
} from 'crypto';

type WechatPayConfig = {
  appId: string;
  mchId: string;
  merchantSerialNo: string;
  notifyUrl: string;
  apiV3Key: string;
  privateKey: KeyObject;
  platformPublicKey: KeyObject;
};

type WechatPayApiErrorPayload = {
  code?: string;
  message?: string;
};

type WechatJsapiPrepayResponse = {
  prepay_id?: string;
};

type WechatOrderQueryResponse = {
  out_trade_no?: string;
  transaction_id?: string;
  trade_state?: string;
  trade_state_desc?: string;
  success_time?: string;
  amount?: Record<string, unknown>;
};

type WechatNotificationEnvelope = {
  id?: string;
  create_time?: string;
  event_type?: string;
  resource_type?: string;
  resource?: {
    algorithm?: string;
    ciphertext?: string;
    associated_data?: string;
    nonce?: string;
    original_type?: string;
  };
};

type WechatNotificationTransaction = {
  out_trade_no?: string;
  transaction_id?: string;
  trade_state?: string;
  trade_state_desc?: string;
  success_time?: string;
  amount?: Record<string, unknown>;
};

export type WechatMiniappPaymentParams = {
  appId: string;
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: string;
  paySign: string;
};

export type WechatPreparePaymentResult = {
  providerPrepayId: string;
  paymentParams: WechatMiniappPaymentParams;
  prepayExpiresAt: Date | null;
};

export type WechatOrderQueryResult = {
  paymentIntentId: string;
  transactionId: string | null;
  tradeState: string;
  tradeStateDesc: string | null;
  successTime: Date | null;
  raw: WechatOrderQueryResponse;
};

export type WechatPayNotificationResult = {
  eventId: string;
  paymentIntentId: string;
  transactionId: string | null;
  tradeState: string;
  tradeStateDesc: string | null;
  successTime: Date | null;
  resource: WechatNotificationTransaction;
  rawEnvelope: WechatNotificationEnvelope;
};

export type WechatCloseOrderResult = {
  status: 'CLOSED' | 'ALREADY_PAID';
};

@Injectable()
export class WechatPayClient {
  private readonly baseUrl = 'https://api.mch.weixin.qq.com';

  prepareJsapiPayment(input: {
    paymentIntentId: string;
    description: string;
    amountCents: number;
    payerOpenId: string;
  }): Promise<WechatPreparePaymentResult> {
    const config = this.getConfig();
    return this.request<WechatJsapiPrepayResponse>({
      method: 'POST',
      path: '/v3/pay/transactions/jsapi',
      body: {
        appid: config.appId,
        mchid: config.mchId,
        description: input.description,
        out_trade_no: input.paymentIntentId,
        notify_url: config.notifyUrl,
        amount: {
          total: input.amountCents,
          currency: 'CNY',
        },
        payer: {
          openid: input.payerOpenId,
        },
      },
    }).then((payload) => {
      if (!payload.prepay_id) {
        throw new UnauthorizedException('WeChat Pay prepay response missing prepay_id');
      }

      const paymentParams = this.buildMiniappPaymentParams(payload.prepay_id);
      return {
        providerPrepayId: payload.prepay_id,
        paymentParams,
        prepayExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      };
    });
  }

  async queryOrder(paymentIntentId: string): Promise<WechatOrderQueryResult> {
    const config = this.getConfig();
    const payload = await this.request<WechatOrderQueryResponse>({
      method: 'GET',
      path: `/v3/pay/transactions/out-trade-no/${encodeURIComponent(paymentIntentId)}?mchid=${encodeURIComponent(config.mchId)}`,
    });

    return {
      paymentIntentId,
      transactionId: payload.transaction_id ?? null,
      tradeState: payload.trade_state ?? 'UNKNOWN',
      tradeStateDesc: payload.trade_state_desc ?? null,
      successTime: payload.success_time ? new Date(payload.success_time) : null,
      raw: payload,
    };
  }

  async closeOrder(paymentIntentId: string): Promise<WechatCloseOrderResult> {
    const config = this.getConfig();

    try {
      await this.request<void>({
        method: 'POST',
        path: `/v3/pay/transactions/out-trade-no/${encodeURIComponent(paymentIntentId)}/close`,
        body: {
          mchid: config.mchId,
        },
      });
      return { status: 'CLOSED' };
    } catch (error) {
      if (
        error instanceof UnauthorizedException &&
        error.message.includes('ORDERPAID')
      ) {
        return { status: 'ALREADY_PAID' };
      }
      throw error;
    }
  }

  parsePaymentNotification(input: {
    rawBody: Buffer | string;
    headers: Record<string, string | string[] | undefined>;
  }): WechatPayNotificationResult {
    const config = this.getConfig();
    const rawBody =
      typeof input.rawBody === 'string'
        ? input.rawBody
        : input.rawBody.toString('utf8');
    const timestamp = this.requireHeader(input.headers, 'wechatpay-timestamp');
    const nonce = this.requireHeader(input.headers, 'wechatpay-nonce');
    const signature = this.requireHeader(input.headers, 'wechatpay-signature');
    const message = `${timestamp}\n${nonce}\n${rawBody}\n`;

    const verifier = createVerify('RSA-SHA256');
    verifier.update(message);
    verifier.end();
    const verified = verifier.verify(config.platformPublicKey, signature, 'base64');
    if (!verified) {
      throw new UnauthorizedException('Invalid WeChat Pay callback signature');
    }

    const envelope = JSON.parse(rawBody) as WechatNotificationEnvelope;
    const resource = envelope.resource;
    if (!resource?.ciphertext || !resource.nonce) {
      throw new UnauthorizedException('Invalid WeChat Pay callback payload');
    }

    const transaction = JSON.parse(
      this.decryptResource({
        ciphertext: resource.ciphertext,
        nonce: resource.nonce,
        associatedData: resource.associated_data ?? '',
      }),
    ) as WechatNotificationTransaction;

    const paymentIntentId = transaction.out_trade_no?.trim();
    if (!paymentIntentId) {
      throw new UnauthorizedException('Missing out_trade_no in WeChat Pay callback');
    }

    return {
      eventId: envelope.id?.trim() || this.computeDigest(rawBody),
      paymentIntentId,
      transactionId: transaction.transaction_id ?? null,
      tradeState: transaction.trade_state ?? 'UNKNOWN',
      tradeStateDesc: transaction.trade_state_desc ?? null,
      successTime: transaction.success_time
        ? new Date(transaction.success_time)
        : null,
      resource: transaction,
      rawEnvelope: envelope,
    };
  }

  computeHeadersDigest(
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer | string,
  ) {
    const flattened = Object.keys(headers)
      .sort()
      .map((key) => [key, headers[key]])
      .map(([key, value]) => `${key}:${Array.isArray(value) ? value.join(',') : (value ?? '')}`)
      .join('\n');
    const body =
      typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    return this.computeDigest(`${flattened}\n\n${body}`);
  }

  private buildMiniappPaymentParams(prepayId: string): WechatMiniappPaymentParams {
    const config = this.getConfig();
    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = randomBytes(16).toString('hex');
    const packageValue = `prepay_id=${prepayId}`;
    const message = `${config.appId}\n${timeStamp}\n${nonceStr}\n${packageValue}\n`;
    const signer = createSign('RSA-SHA256');
    signer.update(message);
    signer.end();

    return {
      appId: config.appId,
      timeStamp,
      nonceStr,
      package: packageValue,
      signType: 'RSA',
      paySign: signer.sign(config.privateKey, 'base64'),
    };
  }

  private async request<T>(input: {
    method: 'GET' | 'POST';
    path: string;
    body?: Record<string, unknown>;
  }): Promise<T> {
    const config = this.getConfig();
    const url = new URL(input.path, this.baseUrl);
    const body = input.body ? JSON.stringify(input.body) : '';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = randomBytes(16).toString('hex');
    const signatureMessage = `${input.method}\n${url.pathname}${url.search}\n${timestamp}\n${nonceStr}\n${body}\n`;
    const signer = createSign('RSA-SHA256');
    signer.update(signatureMessage);
    signer.end();
    const signature = signer.sign(config.privateKey, 'base64');
    const authorization = `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchId}",nonce_str="${nonceStr}",signature="${signature}",timestamp="${timestamp}",serial_no="${config.merchantSerialNo}"`;

    const response = await fetch(url, {
      method: input.method,
      headers: {
        Accept: 'application/json',
        Authorization: authorization,
        'Content-Type': 'application/json',
        'User-Agent': 'TuneTime-Backend/1.0',
      },
      body: body || undefined,
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    if (!response.ok) {
      let payload: WechatPayApiErrorPayload | null = null;
      try {
        payload = JSON.parse(text) as WechatPayApiErrorPayload;
      } catch {
        payload = null;
      }
      const message = payload?.code
        ? `${payload.code}: ${payload.message ?? 'WeChat Pay request failed'}`
        : text || 'WeChat Pay request failed';
      throw new UnauthorizedException(message);
    }

    return JSON.parse(text) as T;
  }

  private decryptResource(input: {
    ciphertext: string;
    nonce: string;
    associatedData: string;
  }) {
    const config = this.getConfig();
    const ciphertext = Buffer.from(input.ciphertext, 'base64');
    const authTag = ciphertext.subarray(ciphertext.length - 16);
    const data = ciphertext.subarray(0, ciphertext.length - 16);
    const decipher = createDecipheriv(
      'aes-256-gcm',
      Buffer.from(config.apiV3Key, 'utf8'),
      Buffer.from(input.nonce, 'utf8'),
      {
        authTagLength: 16,
      },
    );
    decipher.setAuthTag(authTag);
    decipher.setAAD(Buffer.from(input.associatedData, 'utf8'));
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  }

  private requireHeader(
    headers: Record<string, string | string[] | undefined>,
    key: string,
  ) {
    const value = headers[key] ?? headers[key.toLowerCase()];
    if (!value) {
      throw new UnauthorizedException(`Missing WeChat Pay callback header: ${key}`);
    }

    return Array.isArray(value) ? value[0] : value;
  }

  private computeDigest(input: string) {
    return createHash('sha256').update(input).digest('hex');
  }

  private getConfig(): WechatPayConfig {
    const appId = process.env.WECHAT_MINIAPP_APP_ID?.trim();
    const mchId = process.env.WECHAT_PAY_MCH_ID?.trim();
    const merchantSerialNo =
      process.env.WECHAT_PAY_MCH_CERT_SERIAL_NO?.trim();
    const notifyUrl = process.env.WECHAT_PAY_NOTIFY_URL?.trim();
    const apiV3Key = process.env.WECHAT_PAY_API_V3_KEY?.trim();
    const privateKeyPem = process.env.WECHAT_PAY_PRIVATE_KEY_PEM
      ?.replace(/\\n/g, '\n')
      .trim();
    const platformPublicKeyPem = process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM
      ?.replace(/\\n/g, '\n')
      .trim();

    if (
      !appId ||
      !mchId ||
      !merchantSerialNo ||
      !notifyUrl ||
      !apiV3Key ||
      !privateKeyPem ||
      !platformPublicKeyPem
    ) {
      throw new ServiceUnavailableException(
        'WeChat Pay is not fully configured',
      );
    }

    if (Buffer.from(apiV3Key, 'utf8').byteLength !== 32) {
      throw new ServiceUnavailableException(
        'WECHAT_PAY_API_V3_KEY must be 32 bytes',
      );
    }

    return {
      appId,
      mchId,
      merchantSerialNo,
      notifyUrl,
      apiV3Key,
      privateKey: createPrivateKey(privateKeyPem),
      platformPublicKey: createPublicKey(platformPublicKeyPem),
    };
  }
}
