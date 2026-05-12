import {
  BadRequestException,
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
  constants,
  KeyObject,
  publicEncrypt,
  randomBytes,
} from 'crypto';

type WechatPayConfig = {
  appId: string;
  mchId: string;
  merchantSerialNo: string;
  platformSerialNo: string;
  notifyUrl: string;
  apiV3Key: string;
  privateKey: KeyObject;
  platformPublicKey: KeyObject;
  requestTimeoutMs: number;
  refundNotifyUrl: string | null;
  transferNotifyUrl: string | null;
  transferSceneId: string | null;
  transferSceneReportInfos: WechatTransferSceneReportInfo[];
};

type WechatPayApiErrorPayload = {
  code?: string;
  message?: string;
};

type WechatJsapiPrepayResponse = {
  prepay_id?: string;
};

export type WechatPaymentAmount = {
  total?: number;
  payer_total?: number;
  currency?: string;
  payer_currency?: string;
};

type WechatOrderQueryResponse = {
  appid?: string;
  mchid?: string;
  out_trade_no?: string;
  transaction_id?: string;
  trade_state?: string;
  trade_state_desc?: string;
  success_time?: string;
  amount?: WechatPaymentAmount;
};

export type WechatRefundAmount = {
  total?: number;
  refund?: number;
  payer_total?: number;
  payer_refund?: number;
  settlement_refund?: number;
  settlement_total?: number;
  discount_refund?: number;
  currency?: string;
};

export type WechatRefundResponse = {
  refund_id?: string;
  out_refund_no?: string;
  transaction_id?: string;
  out_trade_no?: string;
  channel?: string;
  user_received_account?: string;
  success_time?: string;
  create_time?: string;
  status?: string;
  amount?: WechatRefundAmount;
};

type WechatTransferSceneReportInfo = {
  info_type: string;
  info_content: string;
};

export type WechatTransferResponse = {
  out_bill_no?: string;
  transfer_bill_no?: string;
  create_time?: string;
  state?: string;
  package_info?: string;
  fail_reason?: string;
};

export type WechatTransferNotificationResource = {
  mchid?: string;
  out_bill_no?: string;
  transfer_bill_no?: string;
  state?: string;
  fail_reason?: string;
  update_time?: string;
};

export type WechatBillApplyResponse = {
  hash_type?: string;
  hash_value?: string;
  download_url?: string;
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
  appid?: string;
  mchid?: string;
  out_trade_no?: string;
  transaction_id?: string;
  trade_state?: string;
  trade_state_desc?: string;
  success_time?: string;
  amount?: WechatPaymentAmount;
};

export type WechatRefundNotificationResource = {
  mchid?: string;
  out_trade_no?: string;
  transaction_id?: string;
  out_refund_no?: string;
  refund_id?: string;
  refund_status?: string;
  success_time?: string;
  amount?: WechatRefundAmount;
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
  appId: string | null;
  mchId: string | null;
  transactionId: string | null;
  tradeState: string;
  tradeStateDesc: string | null;
  successTime: Date | null;
  amount: WechatPaymentAmount | null;
  raw: WechatOrderQueryResponse;
};

export type WechatPayNotificationResult = {
  eventId: string;
  paymentIntentId: string;
  appId: string | null;
  mchId: string | null;
  transactionId: string | null;
  tradeState: string;
  tradeStateDesc: string | null;
  successTime: Date | null;
  amount: WechatPaymentAmount | null;
  resource: WechatNotificationTransaction;
  rawEnvelope: WechatNotificationEnvelope;
};

export type WechatRefundResult = {
  outRefundNo: string;
  paymentIntentId: string | null;
  providerRefundId: string | null;
  transactionId: string | null;
  status: string;
  successTime: Date | null;
  amount: WechatRefundAmount | null;
  raw: WechatRefundResponse;
};

export type WechatRefundNotificationResult = {
  eventId: string;
  outRefundNo: string;
  paymentIntentId: string | null;
  mchId: string | null;
  providerRefundId: string | null;
  transactionId: string | null;
  status: string;
  successTime: Date | null;
  amount: WechatRefundAmount | null;
  resource: WechatRefundNotificationResource;
  rawEnvelope: WechatNotificationEnvelope;
};

export type WechatCloseOrderResult = {
  status: 'CLOSED' | 'ALREADY_PAID';
};

export type WechatTransferResult = {
  outBillNo: string;
  transferBillNo: string | null;
  state: string;
  packageInfo: string | null;
  failReason: string | null;
  raw: WechatTransferResponse;
};

export type WechatTransferNotificationResult = {
  eventId: string;
  outBillNo: string;
  mchId: string | null;
  transferBillNo: string | null;
  state: string;
  failReason: string | null;
  updateTime: Date | null;
  resource: WechatTransferNotificationResource;
  rawEnvelope: WechatNotificationEnvelope;
};

export type WechatBillApplyResult = {
  hashType: string;
  hashValue: string;
  downloadUrl: string;
  raw: WechatBillApplyResponse;
};

export type WechatMerchantIdentity = {
  appId: string;
  mchId: string;
};

const MAX_WECHAT_PAY_CLOCK_SKEW_SECONDS = 5 * 60;
const DEFAULT_WECHAT_PAY_REQUEST_TIMEOUT_MS = 5_000;

@Injectable()
export class WechatPayClient {
  private readonly baseUrl = 'https://api.mch.weixin.qq.com';

  prepareJsapiPayment(input: {
    paymentIntentId: string;
    description: string;
    amountCents: number;
    payerOpenId: string;
    timeExpire?: Date | null;
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
        ...(input.timeExpire
          ? {
              time_expire: input.timeExpire.toISOString(),
            }
          : {}),
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
        throw new UnauthorizedException(
          'WeChat Pay prepay response missing prepay_id',
        );
      }

      const paymentParams = this.buildMiniappPaymentParams(payload.prepay_id);
      return {
        providerPrepayId: payload.prepay_id,
        paymentParams,
        prepayExpiresAt: this.resolvePrepayExpiresAt(input.timeExpire),
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
      appId: payload.appid ?? null,
      mchId: payload.mchid ?? null,
      transactionId: payload.transaction_id ?? null,
      tradeState: payload.trade_state ?? 'UNKNOWN',
      tradeStateDesc: payload.trade_state_desc ?? null,
      successTime: payload.success_time ? new Date(payload.success_time) : null,
      amount: payload.amount ?? null,
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

  async createRefund(input: {
    paymentIntentId: string;
    outRefundNo: string;
    amountCents: number;
    totalCents: number;
    reason?: string | null;
  }): Promise<WechatRefundResult> {
    const config = this.getConfig();
    const payload = await this.request<WechatRefundResponse>({
      method: 'POST',
      path: '/v3/refund/domestic/refunds',
      body: {
        out_trade_no: input.paymentIntentId,
        out_refund_no: input.outRefundNo,
        ...(input.reason ? { reason: input.reason.slice(0, 80) } : {}),
        ...(config.refundNotifyUrl
          ? { notify_url: config.refundNotifyUrl }
          : {}),
        amount: {
          refund: input.amountCents,
          total: input.totalCents,
          currency: 'CNY',
        },
      },
    });

    return this.mapRefundResponse(payload, input.outRefundNo);
  }

  async queryRefund(outRefundNo: string): Promise<WechatRefundResult> {
    const payload = await this.request<WechatRefundResponse>({
      method: 'GET',
      path: `/v3/refund/domestic/refunds/${encodeURIComponent(outRefundNo)}`,
    });

    return this.mapRefundResponse(payload, outRefundNo);
  }

  async createTransfer(input: {
    outBillNo: string;
    openId: string;
    amountCents: number;
    remark: string;
    userName?: string | null;
  }): Promise<WechatTransferResult> {
    const config = this.getConfig();
    if (!config.transferSceneId || !config.transferNotifyUrl) {
      throw new ServiceUnavailableException(
        'WeChat Pay transfer is not fully configured',
      );
    }
    if (input.amountCents >= 200_000 && !input.userName) {
      throw new BadRequestException(
        '微信商家转账金额达到实名校验阈值，缺少收款人真实姓名',
      );
    }

    const encryptedUserName = input.userName
      ? this.encryptSensitiveValue(input.userName)
      : null;
    const payload = await this.request<WechatTransferResponse>({
      method: 'POST',
      path: '/v3/fund-app/mch-transfer/transfer-bills',
      extraHeaders: encryptedUserName
        ? { 'Wechatpay-Serial': config.platformSerialNo }
        : undefined,
      body: {
        appid: config.appId,
        out_bill_no: input.outBillNo,
        transfer_scene_id: config.transferSceneId,
        openid: input.openId,
        ...(encryptedUserName ? { user_name: encryptedUserName } : {}),
        transfer_amount: input.amountCents,
        transfer_remark: input.remark.slice(0, 32),
        notify_url: config.transferNotifyUrl,
        user_recv_perception: '课程收入提现',
        transfer_scene_report_infos: config.transferSceneReportInfos,
      },
    });

    return this.mapTransferResponse(payload, input.outBillNo);
  }

  async queryTransferByOutBillNo(
    outBillNo: string,
  ): Promise<WechatTransferResult> {
    const payload = await this.request<WechatTransferResponse>({
      method: 'GET',
      path: `/v3/fund-app/mch-transfer/transfer-bills/out-bill-no/${encodeURIComponent(outBillNo)}`,
    });

    return this.mapTransferResponse(payload, outBillNo);
  }

  async applyBill(input: {
    billDate: string;
    type: 'trade' | 'refund';
  }): Promise<WechatBillApplyResult> {
    const endpoint =
      input.type === 'trade' ? '/v3/bill/tradebill' : '/v3/bill/refundbill';
    const payload = await this.request<WechatBillApplyResponse>({
      method: 'GET',
      path: `${endpoint}?bill_date=${encodeURIComponent(input.billDate)}`,
    });

    if (!payload.hash_type || !payload.hash_value || !payload.download_url) {
      throw new UnauthorizedException('WeChat Pay bill response is incomplete');
    }

    return {
      hashType: payload.hash_type,
      hashValue: payload.hash_value,
      downloadUrl: payload.download_url,
      raw: payload,
    };
  }

  async downloadBill(input: {
    downloadUrl: string;
    hashType: string;
    hashValue: string;
  }): Promise<string> {
    const text = await this.request<string>({
      method: 'GET',
      path: input.downloadUrl,
      skipResponseSignature: true,
      responseType: 'text',
    });

    const hashType = input.hashType.toUpperCase();
    if (hashType !== 'SHA1') {
      throw new UnauthorizedException(
        `Unsupported WeChat Pay bill hash: ${hashType}`,
      );
    }

    const actualHash = createHash('sha1').update(text).digest('hex');
    if (actualHash.toLowerCase() !== input.hashValue.toLowerCase()) {
      throw new UnauthorizedException('WeChat Pay bill hash mismatch');
    }

    return text;
  }

  parsePaymentNotification(input: {
    rawBody: Buffer | string;
    headers: Record<string, string | string[] | undefined>;
  }): WechatPayNotificationResult {
    const rawBody =
      typeof input.rawBody === 'string'
        ? input.rawBody
        : input.rawBody.toString('utf8');
    this.verifyWechatpaySignature(input.headers, rawBody, 'callback');

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
      throw new UnauthorizedException(
        'Missing out_trade_no in WeChat Pay callback',
      );
    }

    return {
      eventId: envelope.id?.trim() || this.computeDigest(rawBody),
      paymentIntentId,
      appId: transaction.appid ?? null,
      mchId: transaction.mchid ?? null,
      transactionId: transaction.transaction_id ?? null,
      tradeState: transaction.trade_state ?? 'UNKNOWN',
      tradeStateDesc: transaction.trade_state_desc ?? null,
      successTime: transaction.success_time
        ? new Date(transaction.success_time)
        : null,
      amount: transaction.amount ?? null,
      resource: transaction,
      rawEnvelope: envelope,
    };
  }

  parseRefundNotification(input: {
    rawBody: Buffer | string;
    headers: Record<string, string | string[] | undefined>;
  }): WechatRefundNotificationResult {
    const { rawBody, envelope } = this.parseNotificationEnvelope(input);
    const refund =
      this.decryptNotificationResource<WechatRefundNotificationResource>(
        envelope,
      );

    const outRefundNo = refund.out_refund_no?.trim();
    if (!outRefundNo) {
      throw new UnauthorizedException(
        'Missing out_refund_no in WeChat refund callback',
      );
    }

    return {
      eventId: envelope.id?.trim() || this.computeDigest(rawBody),
      outRefundNo,
      paymentIntentId: refund.out_trade_no ?? null,
      mchId: refund.mchid ?? null,
      providerRefundId: refund.refund_id ?? null,
      transactionId: refund.transaction_id ?? null,
      status: refund.refund_status ?? 'UNKNOWN',
      successTime: refund.success_time ? new Date(refund.success_time) : null,
      amount: refund.amount ?? null,
      resource: refund,
      rawEnvelope: envelope,
    };
  }

  parseTransferNotification(input: {
    rawBody: Buffer | string;
    headers: Record<string, string | string[] | undefined>;
  }): WechatTransferNotificationResult {
    const { rawBody, envelope } = this.parseNotificationEnvelope(input);
    const transfer =
      this.decryptNotificationResource<WechatTransferNotificationResource>(
        envelope,
      );

    const outBillNo = transfer.out_bill_no?.trim();
    if (!outBillNo) {
      throw new UnauthorizedException(
        'Missing out_bill_no in WeChat transfer callback',
      );
    }

    return {
      eventId: envelope.id?.trim() || this.computeDigest(rawBody),
      outBillNo,
      mchId: transfer.mchid ?? null,
      transferBillNo: transfer.transfer_bill_no ?? null,
      state: transfer.state ?? 'UNKNOWN',
      failReason: transfer.fail_reason ?? null,
      updateTime: transfer.update_time ? new Date(transfer.update_time) : null,
      resource: transfer,
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
      .map(
        ([key, value]) =>
          `${key}:${Array.isArray(value) ? value.join(',') : (value ?? '')}`,
      )
      .join('\n');
    const body =
      typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    return this.computeDigest(`${flattened}\n\n${body}`);
  }

  buildMiniappPaymentParams(prepayId: string): WechatMiniappPaymentParams {
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

  getMerchantIdentity(): WechatMerchantIdentity {
    const config = this.getConfig();
    return {
      appId: config.appId,
      mchId: config.mchId,
    };
  }

  private async request<T>(input: {
    method: 'GET' | 'POST';
    path: string;
    body?: Record<string, unknown>;
    extraHeaders?: Record<string, string>;
    responseType?: 'json' | 'text';
    skipResponseSignature?: boolean;
  }): Promise<T> {
    const config = this.getConfig();
    const url = input.path.startsWith('http')
      ? new URL(input.path)
      : new URL(input.path, this.baseUrl);
    const body = input.body ? JSON.stringify(input.body) : '';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = randomBytes(16).toString('hex');
    const signatureMessage = `${input.method}\n${url.pathname}${url.search}\n${timestamp}\n${nonceStr}\n${body}\n`;
    const signer = createSign('RSA-SHA256');
    signer.update(signatureMessage);
    signer.end();
    const signature = signer.sign(config.privateKey, 'base64');
    const authorization = `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchId}",nonce_str="${nonceStr}",signature="${signature}",timestamp="${timestamp}",serial_no="${config.merchantSerialNo}"`;

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      config.requestTimeoutMs,
    );
    let response: Response;

    try {
      response = await fetch(url, {
        method: input.method,
        headers: {
          Accept: 'application/json',
          Authorization: authorization,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          'User-Agent': 'TuneTime-Backend/1.0',
          ...(input.extraHeaders ?? {}),
        },
        body: body || undefined,
        signal: controller.signal,
      });
    } catch (error) {
      const aborted =
        error instanceof Error &&
        (error.name === 'AbortError' || controller.signal.aborted);
      if (aborted) {
        throw new ServiceUnavailableException('WeChat Pay request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    const text = await response.text();
    if (!input.skipResponseSignature) {
      this.verifyWechatpaySignature(
        this.headersToRecord(response.headers),
        text,
        'response',
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

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

    if (input.responseType === 'text') {
      return text as T;
    }

    if (!text) {
      return undefined as T;
    }

    return JSON.parse(text) as T;
  }

  private parseNotificationEnvelope(input: {
    rawBody: Buffer | string;
    headers: Record<string, string | string[] | undefined>;
  }) {
    const rawBody =
      typeof input.rawBody === 'string'
        ? input.rawBody
        : input.rawBody.toString('utf8');
    this.verifyWechatpaySignature(input.headers, rawBody, 'callback');

    return {
      rawBody,
      envelope: JSON.parse(rawBody) as WechatNotificationEnvelope,
    };
  }

  private decryptNotificationResource<T>(envelope: WechatNotificationEnvelope) {
    const resource = envelope.resource;
    if (!resource?.ciphertext || !resource.nonce) {
      throw new UnauthorizedException('Invalid WeChat Pay callback payload');
    }

    return JSON.parse(
      this.decryptResource({
        ciphertext: resource.ciphertext,
        nonce: resource.nonce,
        associatedData: resource.associated_data ?? '',
      }),
    ) as T;
  }

  private mapRefundResponse(
    payload: WechatRefundResponse,
    fallbackOutRefundNo: string,
  ): WechatRefundResult {
    return {
      outRefundNo: payload.out_refund_no ?? fallbackOutRefundNo,
      paymentIntentId: payload.out_trade_no ?? null,
      providerRefundId: payload.refund_id ?? null,
      transactionId: payload.transaction_id ?? null,
      status: payload.status ?? 'UNKNOWN',
      successTime: payload.success_time ? new Date(payload.success_time) : null,
      amount: payload.amount ?? null,
      raw: payload,
    };
  }

  private mapTransferResponse(
    payload: WechatTransferResponse,
    fallbackOutBillNo: string,
  ): WechatTransferResult {
    return {
      outBillNo: payload.out_bill_no ?? fallbackOutBillNo,
      transferBillNo: payload.transfer_bill_no ?? null,
      state: payload.state ?? 'UNKNOWN',
      packageInfo: payload.package_info ?? null,
      failReason: payload.fail_reason ?? null,
      raw: payload,
    };
  }

  private encryptSensitiveValue(value: string) {
    const config = this.getConfig();
    return publicEncrypt(
      {
        key: config.platformPublicKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
      },
      Buffer.from(value, 'utf8'),
    ).toString('base64');
  }

  private verifyWechatpaySignature(
    headers: Record<string, string | string[] | undefined>,
    body: string,
    context: 'callback' | 'response',
  ) {
    const config = this.getConfig();
    const timestamp = this.requireHeader(headers, 'wechatpay-timestamp');
    const nonce = this.requireHeader(headers, 'wechatpay-nonce');
    const signature = this.requireHeader(headers, 'wechatpay-signature');
    const serial = this.requireHeader(headers, 'wechatpay-serial');

    if (serial !== config.platformSerialNo) {
      throw new UnauthorizedException(
        `Unexpected WeChat Pay ${context} serial number`,
      );
    }

    const timestampSeconds = Number(timestamp);
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (
      !Number.isInteger(timestampSeconds) ||
      Math.abs(nowSeconds - timestampSeconds) >
        MAX_WECHAT_PAY_CLOCK_SKEW_SECONDS
    ) {
      throw new UnauthorizedException(
        `Expired WeChat Pay ${context} signature timestamp`,
      );
    }

    const message = `${timestamp}\n${nonce}\n${body}\n`;
    const verifier = createVerify('RSA-SHA256');
    verifier.update(message);
    verifier.end();
    const verified = verifier.verify(
      config.platformPublicKey,
      signature,
      'base64',
    );
    if (!verified) {
      throw new UnauthorizedException(
        `Invalid WeChat Pay ${context} signature`,
      );
    }
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
      throw new UnauthorizedException(
        `Missing WeChat Pay callback header: ${key}`,
      );
    }

    return Array.isArray(value) ? value[0] : value;
  }

  private headersToRecord(headers: Headers) {
    const record: Record<string, string> = {};
    headers.forEach((value, key) => {
      record[key.toLowerCase()] = value;
    });
    return record;
  }

  private computeDigest(input: string) {
    return createHash('sha256').update(input).digest('hex');
  }

  private resolvePrepayExpiresAt(timeExpire?: Date | null) {
    const providerExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000);
    if (!timeExpire) {
      return providerExpiry;
    }

    return timeExpire.getTime() < providerExpiry.getTime()
      ? timeExpire
      : providerExpiry;
  }

  private getConfig(): WechatPayConfig {
    const appId = process.env.WECHAT_MINIAPP_APP_ID?.trim();
    const mchId = process.env.WECHAT_PAY_MCH_ID?.trim();
    const merchantSerialNo = process.env.WECHAT_PAY_MCH_CERT_SERIAL_NO?.trim();
    const platformSerialNo = process.env.WECHAT_PAY_PLATFORM_SERIAL_NO?.trim();
    const notifyUrl = process.env.WECHAT_PAY_NOTIFY_URL?.trim();
    const apiV3Key = process.env.WECHAT_PAY_API_V3_KEY?.trim();
    const privateKeyPem = process.env.WECHAT_PAY_PRIVATE_KEY_PEM?.replace(
      /\\n/g,
      '\n',
    ).trim();
    const platformPublicKeyPem =
      process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY_PEM?.replace(
        /\\n/g,
        '\n',
      ).trim();

    if (
      !appId ||
      !mchId ||
      !merchantSerialNo ||
      !platformSerialNo ||
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
      platformSerialNo,
      notifyUrl,
      apiV3Key,
      privateKey: createPrivateKey(privateKeyPem),
      platformPublicKey: createPublicKey(platformPublicKeyPem),
      requestTimeoutMs: this.getRequestTimeoutMs(),
      refundNotifyUrl: process.env.WECHAT_PAY_REFUND_NOTIFY_URL?.trim() || null,
      transferNotifyUrl:
        process.env.WECHAT_PAY_TRANSFER_NOTIFY_URL?.trim() || null,
      transferSceneId: process.env.WECHAT_PAY_TRANSFER_SCENE_ID?.trim() || null,
      transferSceneReportInfos: this.getTransferSceneReportInfos(),
    };
  }

  private getRequestTimeoutMs() {
    const timeoutMs = Number(
      process.env.WECHAT_PAY_REQUEST_TIMEOUT_MS ??
        DEFAULT_WECHAT_PAY_REQUEST_TIMEOUT_MS,
    );
    return Number.isFinite(timeoutMs) && timeoutMs > 0
      ? timeoutMs
      : DEFAULT_WECHAT_PAY_REQUEST_TIMEOUT_MS;
  }

  private getTransferSceneReportInfos(): WechatTransferSceneReportInfo[] {
    const raw = process.env.WECHAT_PAY_TRANSFER_SCENE_REPORT_INFOS_JSON?.trim();
    if (raw) {
      const parsed = JSON.parse(raw) as WechatTransferSceneReportInfo[];
      if (
        Array.isArray(parsed) &&
        parsed.every((item) => item.info_type && item.info_content)
      ) {
        return parsed;
      }
      throw new ServiceUnavailableException(
        'WECHAT_PAY_TRANSFER_SCENE_REPORT_INFOS_JSON is invalid',
      );
    }

    return [
      {
        info_type: '服务名称',
        info_content: 'TuneTime上门音乐课',
      },
      {
        info_type: '提现说明',
        info_content: '老师课酬提现',
      },
    ];
  }
}
