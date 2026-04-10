import {
  BookingCancellationReason,
  BookingStatus,
  PaymentIntentStatus,
  PaymentStatus,
  PlatformRole,
  UserStatus,
} from '@prisma/client';
import { createKnownRequestError } from '../test-utils/prisma-test.utils';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  const guardianUser = {
    userId: 'user_guardian_1',
    activeRole: PlatformRole.GUARDIAN,
    roles: [PlatformRole.GUARDIAN],
    status: UserStatus.ACTIVE,
    tokenPayload: {},
  };

  const prisma = {
    booking: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    account: {
      findFirst: jest.fn(),
    },
    paymentIntent: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    paymentProviderEvent: {
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const bookingPaymentProjector = {
    ensurePaymentIntentForBookingTx: jest.fn(),
    resetPaymentIntentForRetryTx: jest.fn(),
    applyPaymentStateTx: jest.fn(),
  };

  const wechatPayClient = {
    prepareJsapiPayment: jest.fn(),
    parsePaymentNotification: jest.fn(),
    computeHeadersDigest: jest.fn(),
    queryOrder: jest.fn(),
    closeOrder: jest.fn(),
    buildMiniappPaymentParams: jest.fn(),
    getMerchantIdentity: jest.fn(),
  };

  let service: PaymentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    wechatPayClient.getMerchantIdentity.mockReturnValue({
      appId: 'wx123',
      mchId: 'mch_1',
    });
    service = new PaymentsService(
      prisma as never,
      bookingPaymentProjector as never,
      wechatPayClient as never,
    );
  });

  it('should prepare booking payment for guardian', async () => {
    const paymentDueAt = new Date(Date.now() + 10 * 60 * 1000);
    prisma.booking.findUnique.mockResolvedValue({
      id: 'booking_1',
      bookingNo: 'BK202604070001',
      status: BookingStatus.PENDING_PAYMENT,
      paymentStatus: PaymentStatus.UNPAID,
      paymentDueAt,
      totalAmount: { toString: () => '183' },
      currency: 'CNY',
      guardianProfile: {
        userId: guardianUser.userId,
      },
      subject: {
        name: '钢琴',
      },
      paymentIntent: null,
    });
    prisma.account.findFirst.mockResolvedValue({
      id: 'acct_1',
      openId: 'openid_1',
    });
    bookingPaymentProjector.ensurePaymentIntentForBookingTx.mockResolvedValue({
      id: 'payment_intent_1',
      status: PaymentIntentStatus.REQUIRES_PAYMENT,
    });
    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        paymentIntent: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            id: 'payment_intent_1',
            status: PaymentIntentStatus.REQUIRES_PAYMENT,
          }),
        },
      }),
    );
    wechatPayClient.prepareJsapiPayment.mockResolvedValue({
      providerPrepayId: 'prepay_1',
      prepayExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      paymentParams: {
        appId: 'wx123',
        timeStamp: '1712460000',
        nonceStr: 'nonce_1',
        package: 'prepay_id=prepay_1',
        signType: 'RSA',
        paySign: 'signature_1',
      },
    });
    prisma.paymentIntent.update.mockResolvedValue({
      id: 'payment_intent_1',
      status: PaymentIntentStatus.REQUIRES_PAYMENT,
      expiresAt: paymentDueAt,
    });

    const result = await service.prepareBookingPayment(
      guardianUser,
      'booking_1',
    );

    expect(result.paymentIntentId).toBe('payment_intent_1');
    expect(result.paymentParams.package).toBe('prepay_id=prepay_1');
    expect(wechatPayClient.prepareJsapiPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentIntentId: 'payment_intent_1',
        timeExpire: paymentDueAt,
      }),
    );
  });

  it('should reuse an unexpired prepay id instead of creating a duplicate order', async () => {
    const paymentDueAt = new Date(Date.now() + 10 * 60 * 1000);
    prisma.booking.findUnique.mockResolvedValue({
      id: 'booking_1',
      bookingNo: 'BK202604070001',
      status: BookingStatus.PENDING_PAYMENT,
      paymentStatus: PaymentStatus.UNPAID,
      paymentDueAt,
      totalAmount: { toString: () => '183' },
      currency: 'CNY',
      guardianProfile: {
        userId: guardianUser.userId,
      },
      subject: {
        name: '钢琴',
      },
      paymentIntent: null,
    });
    prisma.account.findFirst.mockResolvedValue({
      id: 'acct_1',
      openId: 'openid_1',
    });
    bookingPaymentProjector.ensurePaymentIntentForBookingTx.mockResolvedValue({
      id: 'payment_intent_1',
      status: PaymentIntentStatus.REQUIRES_PAYMENT,
    });
    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        paymentIntent: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            id: 'payment_intent_1',
            status: PaymentIntentStatus.REQUIRES_PAYMENT,
            expiresAt: paymentDueAt,
            providerPrepayId: 'prepay_1',
            prepayExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
          }),
        },
      }),
    );
    wechatPayClient.buildMiniappPaymentParams.mockReturnValue({
      appId: 'wx123',
      timeStamp: '1712460000',
      nonceStr: 'nonce_1',
      package: 'prepay_id=prepay_1',
      signType: 'RSA',
      paySign: 'signature_1',
    });

    const result = await service.prepareBookingPayment(
      guardianUser,
      'booking_1',
    );

    expect(result.paymentParams.package).toBe('prepay_id=prepay_1');
    expect(wechatPayClient.prepareJsapiPayment).not.toHaveBeenCalled();
  });

  it('should reconcile booking payment into confirmed state', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: 'booking_1',
      bookingNo: 'BK202604070001',
      status: BookingStatus.PENDING_PAYMENT,
      paymentStatus: PaymentStatus.UNPAID,
      paymentDueAt: new Date(Date.now() + 10 * 60 * 1000),
      totalAmount: { toString: () => '183' },
      currency: 'CNY',
      guardianProfile: {
        userId: guardianUser.userId,
      },
      subject: {
        name: '钢琴',
      },
      paymentIntent: {
        id: 'payment_intent_1',
        status: PaymentIntentStatus.REQUIRES_PAYMENT,
      },
    });
    wechatPayClient.queryOrder.mockResolvedValue({
      paymentIntentId: 'payment_intent_1',
      appId: 'wx123',
      mchId: 'mch_1',
      transactionId: 'wx_tx_1',
      tradeState: 'SUCCESS',
      tradeStateDesc: '支付成功',
      successTime: new Date('2026-04-07T10:00:00.000Z'),
      amount: {
        total: 18300,
        currency: 'CNY',
      },
      raw: {
        appid: 'wx123',
        mchid: 'mch_1',
        trade_state: 'SUCCESS',
        amount: {
          total: 18300,
          currency: 'CNY',
        },
      },
    });
    prisma.paymentIntent.findUniqueOrThrow.mockResolvedValue({
      id: 'payment_intent_1',
      amount: { toString: () => '183' },
      currency: 'CNY',
      booking: {
        id: 'booking_1',
        totalAmount: { toString: () => '183' },
        currency: 'CNY',
      },
    });
    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({}),
    );
    prisma.booking.findUniqueOrThrow.mockResolvedValue({
      id: 'booking_1',
      status: BookingStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PAID,
      paymentIntent: {
        id: 'payment_intent_1',
        status: PaymentIntentStatus.SUCCEEDED,
      },
    });

    const result = await service.reconcileBookingPayment(
      guardianUser,
      'booking_1',
    );

    expect(bookingPaymentProjector.applyPaymentStateTx).toHaveBeenCalled();
    expect(result.bookingStatus).toBe(BookingStatus.CONFIRMED);
    expect(result.paymentStatus).toBe(PaymentStatus.PAID);
  });

  it('should acknowledge duplicate payment notifications idempotently', async () => {
    wechatPayClient.parsePaymentNotification.mockReturnValue({
      eventId: 'event_1',
      paymentIntentId: 'payment_intent_1',
      appId: 'wx123',
      mchId: 'mch_1',
      transactionId: 'wx_tx_1',
      tradeState: 'SUCCESS',
      tradeStateDesc: '支付成功',
      successTime: new Date('2026-04-07T10:00:00.000Z'),
      amount: {
        total: 18300,
        currency: 'CNY',
      },
      resource: {
        appid: 'wx123',
        mchid: 'mch_1',
        out_trade_no: 'payment_intent_1',
        trade_state: 'SUCCESS',
        amount: {
          total: 18300,
          currency: 'CNY',
        },
      },
      rawEnvelope: {
        id: 'event_1',
      },
    });
    wechatPayClient.computeHeadersDigest.mockReturnValue('digest_1');
    prisma.paymentIntent.findUnique.mockResolvedValue({
      id: 'payment_intent_1',
      amount: { toString: () => '183' },
      currency: 'CNY',
      booking: {
        id: 'booking_1',
        totalAmount: { toString: () => '183' },
        currency: 'CNY',
      },
    });
    prisma.$transaction.mockRejectedValue(createKnownRequestError('P2002'));

    const result = await service.handleWechatNotification({
      rawBody: Buffer.from('{}'),
      headers: {},
    });

    expect(result.code).toBe('SUCCESS');
    expect(result.message).toContain('Duplicate');
  });

  it('should reject payment notifications with mismatched paid amount', async () => {
    wechatPayClient.parsePaymentNotification.mockReturnValue({
      eventId: 'event_1',
      paymentIntentId: 'payment_intent_1',
      appId: 'wx123',
      mchId: 'mch_1',
      transactionId: 'wx_tx_1',
      tradeState: 'SUCCESS',
      tradeStateDesc: '支付成功',
      successTime: new Date('2026-04-07T10:00:00.000Z'),
      amount: {
        total: 18200,
        currency: 'CNY',
      },
      resource: {
        appid: 'wx123',
        mchid: 'mch_1',
        out_trade_no: 'payment_intent_1',
        trade_state: 'SUCCESS',
        amount: {
          total: 18200,
          currency: 'CNY',
        },
      },
      rawEnvelope: {
        id: 'event_1',
      },
    });
    wechatPayClient.computeHeadersDigest.mockReturnValue('digest_1');
    prisma.paymentIntent.findUnique.mockResolvedValue({
      id: 'payment_intent_1',
      amount: { toString: () => '183' },
      currency: 'CNY',
      booking: {
        id: 'booking_1',
        totalAmount: { toString: () => '183' },
        currency: 'CNY',
      },
    });
    prisma.paymentProviderEvent.create.mockResolvedValue({
      id: 'provider_event_1',
    });
    prisma.paymentProviderEvent.update.mockResolvedValue(undefined);
    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        paymentProviderEvent: prisma.paymentProviderEvent,
      }),
    );

    await expect(
      service.handleWechatNotification({
        rawBody: Buffer.from('{}'),
        headers: {},
      }),
    ).rejects.toThrow('金额');

    expect(bookingPaymentProjector.applyPaymentStateTx).not.toHaveBeenCalled();
    expect(prisma.paymentProviderEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          processResult: expect.stringContaining('REJECTED'),
        }),
      }),
    );
  });

  it('should close pending booking payment and project cancellation', async () => {
    wechatPayClient.closeOrder.mockResolvedValue({
      status: 'CLOSED',
    });
    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({}),
    );

    await service.cancelPendingBookingPayment({
      paymentIntentId: 'payment_intent_1',
      paymentDueAt: new Date('2026-04-07T12:00:00.000Z'),
      cancellationReason: BookingCancellationReason.STUDENT_REQUEST,
      cancelledAt: new Date('2026-04-07T10:30:00.000Z'),
      cancelledByUserId: 'user_guardian_1',
      remark: '家长改期，先取消本单',
    });

    expect(wechatPayClient.closeOrder).toHaveBeenCalledWith('payment_intent_1');
    expect(bookingPaymentProjector.applyPaymentStateTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        paymentIntentId: 'payment_intent_1',
        status: PaymentIntentStatus.CANCELLED,
        bookingCancellationReason: BookingCancellationReason.STUDENT_REQUEST,
      }),
    );
  });

  it('should reconcile and reject cancellation when provider reports already paid', async () => {
    wechatPayClient.closeOrder.mockResolvedValue({
      status: 'ALREADY_PAID',
    });
    wechatPayClient.queryOrder.mockResolvedValue({
      paymentIntentId: 'payment_intent_1',
      appId: 'wx123',
      mchId: 'mch_1',
      transactionId: 'wx_tx_1',
      tradeState: 'SUCCESS',
      tradeStateDesc: '支付成功',
      successTime: new Date('2026-04-07T10:00:00.000Z'),
      amount: {
        total: 18300,
        currency: 'CNY',
      },
      raw: {
        appid: 'wx123',
        mchid: 'mch_1',
        trade_state: 'SUCCESS',
        amount: {
          total: 18300,
          currency: 'CNY',
        },
      },
    });
    prisma.paymentIntent.findUniqueOrThrow.mockResolvedValue({
      id: 'payment_intent_1',
      amount: { toString: () => '183' },
      currency: 'CNY',
      booking: {
        id: 'booking_1',
        totalAmount: { toString: () => '183' },
        currency: 'CNY',
      },
    });
    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({}),
    );

    await expect(
      service.cancelPendingBookingPayment({
        paymentIntentId: 'payment_intent_1',
        paymentDueAt: new Date('2026-04-07T12:00:00.000Z'),
        cancellationReason: BookingCancellationReason.STUDENT_REQUEST,
        cancelledAt: new Date('2026-04-07T10:30:00.000Z'),
        cancelledByUserId: 'user_guardian_1',
        remark: '家长想取消',
      }),
    ).rejects.toThrow('支付已完成');

    expect(wechatPayClient.queryOrder).toHaveBeenCalledWith('payment_intent_1');
    expect(bookingPaymentProjector.applyPaymentStateTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        paymentIntentId: 'payment_intent_1',
        status: PaymentIntentStatus.SUCCEEDED,
      }),
    );
  });
});
