import {
  BookingExceptionStatus,
  BookingStatus,
  Currency,
  LedgerStatus,
  PaymentIntentStatus,
  PaymentRefundStatus,
  PayoutStatus,
  PlatformRole,
  Prisma,
  SettlementReadiness,
  TransactionDirection,
  WalletStatus,
  WalletTransactionType,
} from '@prisma/client';
import { FundsService } from './funds.service';

describe('FundsService', () => {
  const adminUser = {
    userId: 'admin_1',
    activeRole: PlatformRole.ADMIN,
    roles: [PlatformRole.ADMIN],
    status: 'ACTIVE',
    tokenPayload: {},
  };
  const teacherUser = {
    userId: 'teacher_user_1',
    activeRole: PlatformRole.TEACHER,
    roles: [PlatformRole.TEACHER],
    status: 'ACTIVE',
    tokenPayload: {},
  };

  const prisma = {
    booking: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    paymentRefund: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    paymentProviderEvent: {
      create: jest.fn(),
      update: jest.fn(),
    },
    wallet: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    walletTransaction: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
      findFirstOrThrow: jest.fn(),
    },
    teacherProfile: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    account: {
      findFirst: jest.fn(),
    },
    teacherPayoutAccount: {
      upsert: jest.fn(),
    },
    payout: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    adminAuditLog: {
      create: jest.fn(),
    },
    reconciliationRun: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    reconciliationDifference: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    paymentIntent: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const bookingPaymentProjector = {
    applyPaymentStateTx: jest.fn(),
  };

  const wechatPayClient = {
    createRefund: jest.fn(),
    queryRefund: jest.fn(),
    parseRefundNotification: jest.fn(),
    parseTransferNotification: jest.fn(),
    computeHeadersDigest: jest.fn(),
    getMerchantIdentity: jest.fn(),
    createTransfer: jest.fn(),
    queryTransferByOutBillNo: jest.fn(),
    applyBill: jest.fn(),
    downloadBill: jest.fn(),
  };

  let service: FundsService;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.WECHAT_PAY_TRANSFER_ENABLED;
    delete process.env.WECHAT_PAY_TRANSFER_SCENE_ID;
    delete process.env.WECHAT_PAY_TRANSFER_NOTIFY_URL;
    wechatPayClient.getMerchantIdentity.mockReturnValue({
      appId: 'wx123',
      mchId: 'mch_1',
    });
    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback(prisma),
    );
    service = new FundsService(
      prisma as never,
      bookingPaymentProjector as never,
      wechatPayClient as never,
    );
  });

  it('rejects refunds after teacher wallet settlement', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: 'booking_1',
      paymentIntent: {
        id: 'payment_intent_1',
        status: PaymentIntentStatus.SUCCEEDED,
        amount: new Prisma.Decimal(120),
        currency: Currency.CNY,
      },
      paymentRefunds: [],
      walletTransactions: [
        {
          id: 'txn_1',
          type: WalletTransactionType.BOOKING_PAYMENT,
          status: LedgerStatus.SETTLED,
        },
      ],
    });

    await expect(
      service.createFullRefund(adminUser as never, 'booking_1', {}),
    ).rejects.toThrow('订单已结算入老师钱包');
    expect(wechatPayClient.createRefund).not.toHaveBeenCalled();
  });

  it('settles a completed booking into the teacher wallet', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: 'booking_1',
      status: BookingStatus.COMPLETED,
      settlementReadiness: SettlementReadiness.READY,
      exceptionStatus: BookingExceptionStatus.NONE,
      totalAmount: new Prisma.Decimal(120),
      platformFeeAmount: new Prisma.Decimal(20),
      currency: Currency.CNY,
      teacherProfile: { userId: 'teacher_user_1' },
      paymentIntent: {
        id: 'payment_intent_1',
        status: PaymentIntentStatus.SUCCEEDED,
      },
      paymentRefunds: [],
      exceptionCases: [],
      walletTransactions: [],
    });
    prisma.wallet.upsert.mockResolvedValue({
      id: 'wallet_1',
      availableBalance: new Prisma.Decimal(0),
    });
    prisma.walletTransaction.create.mockResolvedValue({
      id: 'txn_1',
      walletId: 'wallet_1',
      type: WalletTransactionType.BOOKING_PAYMENT,
      status: LedgerStatus.SETTLED,
      direction: TransactionDirection.IN,
      amount: new Prisma.Decimal(100),
      balanceAfter: null,
      occurredAt: new Date('2026-04-10T00:00:00.000Z'),
    });
    prisma.wallet.update.mockResolvedValue({
      id: 'wallet_1',
      availableBalance: new Prisma.Decimal(100),
    });
    prisma.walletTransaction.update.mockResolvedValue({
      id: 'txn_1',
      type: WalletTransactionType.BOOKING_PAYMENT,
      status: LedgerStatus.SETTLED,
      direction: TransactionDirection.IN,
      amount: new Prisma.Decimal(100),
      balanceAfter: new Prisma.Decimal(100),
      occurredAt: new Date('2026-04-10T00:00:00.000Z'),
    });

    const result = await service.settleBooking(adminUser as never, 'booking_1');

    expect(result.amount).toBe(100);
    expect(result.balanceAfter).toBe(100);
    expect(prisma.wallet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          availableBalance: { increment: new Prisma.Decimal(100) },
        },
      }),
    );
  });

  it('creates a teacher payout request without locking balance yet', async () => {
    prisma.teacherProfile.findUnique.mockResolvedValueOnce({
      id: 'teacher_profile_1',
      userId: teacherUser.userId,
    });
    prisma.wallet.findUnique.mockResolvedValue({
      id: 'wallet_1',
      ownerUserId: teacherUser.userId,
      availableBalance: new Prisma.Decimal(150),
      lockedBalance: new Prisma.Decimal(0),
      status: WalletStatus.ACTIVE,
      currency: Currency.CNY,
    });
    prisma.teacherProfile.findUniqueOrThrow.mockResolvedValue({
      userId: teacherUser.userId,
      displayName: '王老师',
    });
    prisma.account.findFirst.mockResolvedValue({
      openId: 'openid_teacher_1',
    });
    prisma.teacherPayoutAccount.upsert.mockResolvedValue({
      id: 'payout_account_1',
      accountToken: 'wechat:openid_teacher_1',
    });
    prisma.payout.create.mockResolvedValue({
      id: 'payout_1',
      amount: new Prisma.Decimal(80),
      status: PayoutStatus.PENDING,
      outBillNo: null,
      transferBillNo: null,
      transferState: null,
      packageInfo: null,
      failureReason: null,
    });

    const result = await service.createPayout(teacherUser as never, {
      amount: 80,
    });

    expect(result.status).toBe(PayoutStatus.PENDING);
    expect(prisma.wallet.updateMany).not.toHaveBeenCalled();
  });

  it('locks payout balance and settles it when WeChat transfer succeeds', async () => {
    process.env.WECHAT_PAY_TRANSFER_ENABLED = 'true';
    process.env.WECHAT_PAY_TRANSFER_SCENE_ID = '1000';
    process.env.WECHAT_PAY_TRANSFER_NOTIFY_URL =
      'https://api.example.com/payments/wechat/transfer-notify';
    prisma.$transaction
      .mockImplementationOnce(async (callback: any) =>
        callback({
          payout: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'payout_1',
              amount: new Prisma.Decimal(50),
              status: PayoutStatus.PENDING,
              wallet: { id: 'wallet_1' },
              payoutAccount: {
                id: 'payout_account_1',
                accountToken: 'wechat:openid_teacher_1',
              },
              teacherProfile: {
                user: { realNameVerifiedName: '王老师' },
              },
            }),
            update: jest.fn().mockResolvedValue(undefined),
          },
          wallet: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            findUniqueOrThrow: jest.fn().mockResolvedValue({
              id: 'wallet_1',
              availableBalance: new Prisma.Decimal(100),
            }),
          },
          walletTransaction: {
            create: jest.fn().mockResolvedValue(undefined),
          },
        }),
      )
      .mockImplementationOnce(async (callback: any) =>
        callback({
          payout: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({
              id: 'payout_1',
              amount: new Prisma.Decimal(50),
              status: PayoutStatus.APPROVED,
              walletId: 'wallet_1',
              outBillNo: 'PO123',
            }),
            update: jest.fn().mockResolvedValue({
              id: 'payout_1',
              amount: new Prisma.Decimal(50),
              status: PayoutStatus.PAID,
              outBillNo: 'PO123',
              transferBillNo: 'TB123',
              transferState: 'SUCCESS',
              packageInfo: null,
              failureReason: null,
            }),
          },
          wallet: {
            update: jest.fn().mockResolvedValue(undefined),
          },
          walletTransaction: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
        }),
      );
    wechatPayClient.createTransfer.mockResolvedValue({
      outBillNo: 'PO123',
      transferBillNo: 'TB123',
      state: 'SUCCESS',
      packageInfo: null,
      failReason: null,
      raw: {},
    });

    const result = await service.approvePayout(adminUser as never, 'payout_1');

    expect(result.status).toBe(PayoutStatus.PAID);
    expect(wechatPayClient.createTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        openId: 'openid_teacher_1',
        amountCents: 5000,
      }),
    );
  });
});
