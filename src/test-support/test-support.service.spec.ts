import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { TEST_SUPPORT_PASSWORD } from './test-support.constants';
import { TestSupportLogStore } from './test-support-log.store';
import { TestSupportService } from './test-support.service';

describe('TestSupportService', () => {
  const prisma = {
    booking: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    rescheduleRequest: {
      count: jest.fn(),
    },
  } as any;
  const bookingsService = {
    updatePayment: jest.fn(),
  } as any;
  const logStore = {
    list: jest.fn(),
    clear: jest.fn(),
    append: jest.fn(),
  } as unknown as jest.Mocked<TestSupportLogStore>;

  let service: TestSupportService;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.TEST_SUPPORT_ENABLED = 'true';
    prisma.rescheduleRequest.count.mockResolvedValue(0);
    service = new TestSupportService(prisma, bookingsService, logStore);
  });

  afterAll(() => {
    delete process.env.TEST_SUPPORT_ENABLED;
  });

  it('should expose deterministic accounts and existing bookings', async () => {
    prisma.booking.findMany.mockResolvedValue([
      {
        id: 'qa_booking_pending_payment',
        bookingNo: 'QATASK0PAY01',
        status: 'PENDING_PAYMENT',
        paymentStatus: PaymentStatus.UNPAID,
        startAt: new Date('2026-03-21T11:00:00.000Z'),
        endAt: new Date('2026-03-21T12:00:00.000Z'),
        teacherProfile: { displayName: 'QA老师' },
        studentProfile: { displayName: 'QA学员' },
        guardianProfile: { displayName: 'QA家长' },
      },
    ]);
    logStore.list.mockResolvedValue([
      {
        id: 'evt_1',
        type: 'QA_SCENARIO_RESET',
        message: 'reset',
        bookingId: null,
        payload: null,
        createdAt: '2026-03-20T10:00:00.000Z',
      },
    ]);

    const result = await service.getQaScenario();

    expect(result.enabled).toBe(true);
    expect(result.scenarioVariant).toBe('task0');
    expect(result.scenarioLabel).toContain('Task 0');
    expect(result.accounts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'guardian',
          phone: '13900000001',
          password: TEST_SUPPORT_PASSWORD,
        }),
        expect.objectContaining({
          key: 'teacher',
          phone: '13900000002',
        }),
      ]),
    );
    expect(result.bookings).toEqual([
      expect.objectContaining({
        id: 'qa_booking_pending_payment',
        teacherDisplayName: 'QA老师',
        guardianDisplayName: 'QA家长',
      }),
    ]);
    expect(result.events).toHaveLength(1);
  });

  it('should apply mock payment and append a success event', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: 'qa_booking_pending_payment',
      bookingNo: 'QATASK0PAY01',
      guardianProfileId: 'qa_guardian_profile',
    });
    prisma.booking.findMany.mockResolvedValue([]);
    logStore.list.mockResolvedValue([]);

    await service.mockPayment({
      bookingId: 'qa_booking_pending_payment',
      outcome: 'success',
    });

    expect(bookingsService.updatePayment).toHaveBeenCalledWith(
      undefined,
      'qa_booking_pending_payment',
      { paymentStatus: PaymentStatus.PAID },
    );
    expect(logStore.append).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'MOCK_PAYMENT_SUCCEEDED',
        bookingId: 'qa_booking_pending_payment',
      }),
    );
  });

  it('should reject missing bookings when mocking payment', async () => {
    prisma.booking.findUnique.mockResolvedValue(null);

    await expect(
      service.mockPayment({
        bookingId: 'missing',
        outcome: 'failed',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should block access when support is disabled', async () => {
    process.env.TEST_SUPPORT_ENABLED = 'false';
    const disabledService = new TestSupportService(
      prisma,
      bookingsService,
      logStore,
    );

    await expect(disabledService.getQaScenario()).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
