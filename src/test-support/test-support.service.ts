import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  GradeLevel,
  GuardianRelation,
  PaymentStatus,
  PlatformRole,
  Prisma,
  RescheduleRequestStatus,
  TeacherEmploymentType,
  TeacherVerificationStatus,
  Weekday,
} from '@prisma/client';
import { hashPassword } from '../auth/password.util';
import { BookingsService } from '../bookings/bookings.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  TEST_SUPPORT_ACCOUNTS,
  TEST_SUPPORT_BOOKINGS,
  TEST_SUPPORT_PASSWORD,
  TEST_SUPPORT_SCENARIO_VARIANTS,
  TEST_SUPPORT_SUBJECT,
} from './test-support.constants';
import {
  MockPaymentRequestDto,
  ResetQaScenarioRequestDto,
  QaScenarioResetResponseDto,
  QaScenarioResponseDto,
} from './dto/test-support.dto';
import { TestSupportLogStore } from './test-support-log.store';

type QaScenarioBooking = {
  key: string;
  id: string;
  bookingNo: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  startAt: string;
  endAt: string;
  teacherDisplayName: string;
  studentDisplayName: string;
  guardianDisplayName: string;
};

type TxClient = Prisma.TransactionClient;
type QaScenarioVariant =
  (typeof TEST_SUPPORT_SCENARIO_VARIANTS)[keyof typeof TEST_SUPPORT_SCENARIO_VARIANTS]['key'];

@Injectable()
export class TestSupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingsService: BookingsService,
    private readonly logStore: TestSupportLogStore,
  ) {}

  private readonly enabled =
    process.env.TEST_SUPPORT_ENABLED != null
      ? process.env.TEST_SUPPORT_ENABLED === 'true'
      : process.env.NODE_ENV !== 'production';

  async getQaScenario(): Promise<QaScenarioResponseDto> {
    this.ensureEnabled();
    const bookings = await this.loadQaBookings();
    const scenario = await this.detectScenarioVariant(bookings);

    return {
      enabled: true,
      scenarioVariant: scenario.key,
      scenarioLabel: scenario.label,
      accounts: this.buildQaAccounts(),
      bookings,
      events: await this.logStore.list(),
    };
  }

  async resetQaScenario(
    dto?: ResetQaScenarioRequestDto,
  ): Promise<QaScenarioResetResponseDto> {
    this.ensureEnabled();
    const variant = this.resolveScenarioVariant(dto?.variant);

    await this.logStore.clear();
    await this.deleteExistingQaData();
    await this.seedQaData(variant);
    await this.logStore.append({
      type: 'QA_SCENARIO_RESET',
      message: `${this.describeScenario(variant)} 已重置到初始状态。`,
      payload: {
        scenarioVariant: variant,
        bookingId: TEST_SUPPORT_BOOKINGS.pendingPayment.id,
      },
    });

    const snapshot = await this.getQaScenario();
    return {
      ...snapshot,
      resetAt: new Date().toISOString(),
    };
  }

  async mockPayment(
    dto: MockPaymentRequestDto,
  ): Promise<QaScenarioResponseDto> {
    this.ensureEnabled();

    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId.trim() },
      select: {
        id: true,
        bookingNo: true,
        guardianProfileId: true,
      },
    });

    if (!booking) {
      throw new NotFoundException(`未找到预约：${dto.bookingId}`);
    }

    const paymentStatus =
      dto.outcome === 'success' ? PaymentStatus.PAID : PaymentStatus.FAILED;

    await this.bookingsService.updatePayment(undefined, booking.id, {
      paymentStatus,
    });

    await this.logStore.append({
      type:
        dto.outcome === 'success'
          ? 'MOCK_PAYMENT_SUCCEEDED'
          : 'MOCK_PAYMENT_FAILED',
      message:
        dto.outcome === 'success'
          ? `开发态模拟支付成功：${booking.bookingNo}`
          : `开发态模拟支付失败：${booking.bookingNo}`,
      bookingId: booking.id,
      payload: {
        outcome: dto.outcome,
        paymentStatus,
      },
    });

    return this.getQaScenario();
  }

  private ensureEnabled() {
    if (!this.enabled) {
      throw new ForbiddenException(
        'Test support is disabled in the current environment.',
      );
    }
  }

  private buildQaAccounts() {
    return Object.values(TEST_SUPPORT_ACCOUNTS).map((account) => ({
      key: account.key,
      label: account.label,
      phone: account.phone,
      email: account.email,
      password: TEST_SUPPORT_PASSWORD,
      roles: [...account.roles],
      notes: account.notes,
    }));
  }

  private compactStrings(values: Array<string | null | undefined>): string[] {
    return values.filter((value): value is string => Boolean(value));
  }

  private resolveScenarioVariant(value?: string): QaScenarioVariant {
    const normalized = value?.trim().toLowerCase();
    if (!normalized) {
      return TEST_SUPPORT_SCENARIO_VARIANTS.task0.key;
    }

    const match = Object.values(TEST_SUPPORT_SCENARIO_VARIANTS).find(
      (item) => item.key === normalized,
    );
    return (match?.key ??
      TEST_SUPPORT_SCENARIO_VARIANTS.task0.key) as QaScenarioVariant;
  }

  private describeScenario(variant: QaScenarioVariant): string {
    return (
      Object.values(TEST_SUPPORT_SCENARIO_VARIANTS).find(
        (item) => item.key === variant,
      )?.label ?? TEST_SUPPORT_SCENARIO_VARIANTS.task0.label
    );
  }

  private async detectScenarioVariant(bookings: QaScenarioBooking[]) {
    const bookingKeys = bookings.map((item) => item.key);

    const pendingRescheduleCount = await this.prisma.rescheduleRequest.count({
      where: {
        bookingId: {
          in: Object.values(TEST_SUPPORT_BOOKINGS).map((item) => item.id),
        },
        status: RescheduleRequestStatus.PENDING,
      },
    });

    if (pendingRescheduleCount > 0) {
      return TEST_SUPPORT_SCENARIO_VARIANTS.task5Reschedule;
    }

    if (
      bookingKeys.includes(TEST_SUPPORT_BOOKINGS.pendingPayment.key) &&
      bookingKeys.includes(TEST_SUPPORT_BOOKINGS.confirmed.key)
    ) {
      return TEST_SUPPORT_SCENARIO_VARIANTS.task4Confirmed;
    }

    if (bookingKeys.includes(TEST_SUPPORT_BOOKINGS.task2Occupied.key)) {
      return TEST_SUPPORT_SCENARIO_VARIANTS.task2Base;
    }

    if (
      bookingKeys.includes(TEST_SUPPORT_BOOKINGS.pendingAcceptance.key) &&
      !bookingKeys.includes(TEST_SUPPORT_BOOKINGS.confirmed.key)
    ) {
      return TEST_SUPPORT_SCENARIO_VARIANTS.task3BookingCreated;
    }

    if (
      bookingKeys.includes(TEST_SUPPORT_BOOKINGS.pendingAcceptance.key) ||
      bookingKeys.includes(TEST_SUPPORT_BOOKINGS.confirmed.key)
    ) {
      return TEST_SUPPORT_SCENARIO_VARIANTS.task1Pending;
    }

    if (bookings.length === 0) {
      return TEST_SUPPORT_SCENARIO_VARIANTS.task1Empty;
    }

    return TEST_SUPPORT_SCENARIO_VARIANTS.task0;
  }

  private async loadQaBookings(): Promise<QaScenarioBooking[]> {
    const items = await this.prisma.booking.findMany({
      where: {
        id: {
          in: Object.values(TEST_SUPPORT_BOOKINGS).map((item) => item.id),
        },
      },
      select: {
        id: true,
        bookingNo: true,
        status: true,
        paymentStatus: true,
        startAt: true,
        endAt: true,
        teacherProfile: {
          select: {
            displayName: true,
          },
        },
        studentProfile: {
          select: {
            displayName: true,
          },
        },
        guardianProfile: {
          select: {
            displayName: true,
          },
        },
      },
      orderBy: { startAt: 'asc' },
    });

    return items.map((item) => ({
      key:
        Object.values(TEST_SUPPORT_BOOKINGS).find(
          (booking) => booking.id === item.id,
        )?.key ?? item.id,
      id: item.id,
      bookingNo: item.bookingNo,
      status: item.status,
      paymentStatus: item.paymentStatus,
      startAt: item.startAt.toISOString(),
      endAt: item.endAt.toISOString(),
      teacherDisplayName: item.teacherProfile.displayName,
      studentDisplayName: item.studentProfile.displayName,
      guardianDisplayName: item.guardianProfile?.displayName ?? '',
    }));
  }

  private async deleteExistingQaData() {
    const qaIdentifiers = Object.values(TEST_SUPPORT_ACCOUNTS);
    const knownTeacherProfileIds = this.compactStrings(
      qaIdentifiers.map((item) =>
        'teacherProfileId' in item ? item.teacherProfileId : null,
      ),
    );
    const knownGuardianProfileIds = this.compactStrings(
      qaIdentifiers.map((item) =>
        'guardianProfileId' in item ? item.guardianProfileId : null,
      ),
    );
    const knownStudentProfileIds = this.compactStrings(
      qaIdentifiers.map((item) =>
        'studentProfileId' in item ? item.studentProfileId : null,
      ),
    );
    const knownAddressIds = this.compactStrings(
      qaIdentifiers.map((item) =>
        'addressId' in item ? item.addressId : null,
      ),
    );
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          {
            id: {
              in: qaIdentifiers.map((item) => item.userId),
            },
          },
          {
            email: {
              in: qaIdentifiers.map((item) => item.email),
            },
          },
          {
            phone: {
              in: qaIdentifiers.map((item) => item.phone),
            },
          },
        ],
      },
      select: {
        id: true,
        teacherProfile: { select: { id: true } },
        guardianProfile: { select: { id: true } },
        studentProfile: { select: { id: true } },
      },
    });

    const userIds = Array.from(
      new Set([
        ...qaIdentifiers.map((item) => item.userId),
        ...users.map((item) => item.id),
      ]),
    );
    const teacherProfileIds = Array.from(
      new Set([
        ...knownTeacherProfileIds,
        ...users
          .map((item) => item.teacherProfile?.id)
          .filter((item): item is string => !!item),
      ]),
    );
    const guardianProfileIds = Array.from(
      new Set([
        ...knownGuardianProfileIds,
        ...users
          .map((item) => item.guardianProfile?.id)
          .filter((item): item is string => !!item),
      ]),
    );
    const studentProfileIds = Array.from(
      new Set([
        ...knownStudentProfileIds,
        ...users
          .map((item) => item.studentProfile?.id)
          .filter((item): item is string => !!item),
      ]),
    );

    const bookingIds = (
      await this.prisma.booking.findMany({
        where: {
          OR: [
            { teacherProfileId: { in: teacherProfileIds } },
            { guardianProfileId: { in: guardianProfileIds } },
            { studentProfileId: { in: studentProfileIds } },
            {
              id: {
                in: Object.values(TEST_SUPPORT_BOOKINGS).map((item) => item.id),
              },
            },
          ],
        },
        select: { id: true },
      })
    ).map((item) => item.id);

    await this.prisma.$transaction(async (tx) => {
      if (userIds.length > 0) {
        await tx.bookingHold.deleteMany({
          where: { createdByUserId: { in: userIds } },
        });
      }

      if (bookingIds.length > 0) {
        await tx.rescheduleRequest.deleteMany({
          where: { bookingId: { in: bookingIds } },
        });
        await tx.walletTransaction.deleteMany({
          where: {
            OR: [
              { bookingId: { in: bookingIds } },
              { referenceId: { in: bookingIds } },
            ],
          },
        });
        await tx.paymentIntent.deleteMany({
          where: { bookingId: { in: bookingIds } },
        });
        await tx.lesson.deleteMany({
          where: { bookingId: { in: bookingIds } },
        });
        await tx.booking.deleteMany({
          where: { id: { in: bookingIds } },
        });
      }

      if (teacherProfileIds.length > 0) {
        await tx.teacherAvailabilityBlock.deleteMany({
          where: { teacherProfileId: { in: teacherProfileIds } },
        });
        await tx.teacherAvailabilityRule.deleteMany({
          where: { teacherProfileId: { in: teacherProfileIds } },
        });
        await tx.teacherCredential.deleteMany({
          where: { teacherProfileId: { in: teacherProfileIds } },
        });
        await tx.teacherServiceArea.deleteMany({
          where: { teacherProfileId: { in: teacherProfileIds } },
        });
        await tx.teacherSubject.deleteMany({
          where: { teacherProfileId: { in: teacherProfileIds } },
        });
        await tx.teacherProfile.deleteMany({
          where: { id: { in: teacherProfileIds } },
        });
      }

      if (studentProfileIds.length > 0 || guardianProfileIds.length > 0) {
        await tx.studentGuardian.deleteMany({
          where: {
            OR: [
              { studentProfileId: { in: studentProfileIds } },
              { guardianProfileId: { in: guardianProfileIds } },
            ],
          },
        });
      }

      if (guardianProfileIds.length > 0) {
        await tx.guardianProfile.deleteMany({
          where: { id: { in: guardianProfileIds } },
        });
      }

      if (studentProfileIds.length > 0) {
        await tx.studentProfile.deleteMany({
          where: { id: { in: studentProfileIds } },
        });
      }

      if (userIds.length > 0) {
        await tx.adminAuditLog.deleteMany({
          where: { actorUserId: { in: userIds } },
        });
        await tx.realNameVerificationSession.deleteMany({
          where: { userId: { in: userIds } },
        });
        await tx.authVerificationCode.deleteMany({
          where: { userId: { in: userIds } },
        });
        await tx.session.deleteMany({
          where: { userId: { in: userIds } },
        });
        await tx.account.deleteMany({
          where: { userId: { in: userIds } },
        });
        await tx.passwordCredential.deleteMany({
          where: { userId: { in: userIds } },
        });
        await tx.userRole.deleteMany({
          where: { userId: { in: userIds } },
        });
        await tx.address.deleteMany({
          where: {
            OR: [{ userId: { in: userIds } }, { id: { in: knownAddressIds } }],
          },
        });
        await tx.wallet.deleteMany({
          where: { ownerUserId: { in: userIds } },
        });
        await tx.user.deleteMany({
          where: { id: { in: userIds } },
        });
      }
    });
  }

  private async seedQaData(variant: QaScenarioVariant) {
    const piano = await this.prisma.subject.upsert({
      where: { code: TEST_SUPPORT_SUBJECT.code },
      create: {
        code: TEST_SUPPORT_SUBJECT.code,
        name: TEST_SUPPORT_SUBJECT.name,
        description: TEST_SUPPORT_SUBJECT.description,
        isActive: true,
      },
      update: {
        name: TEST_SUPPORT_SUBJECT.name,
        description: TEST_SUPPORT_SUBJECT.description,
        isActive: true,
      },
      select: { id: true },
    });

    const passwordHash = await hashPassword(TEST_SUPPORT_PASSWORD);
    const now = new Date();
    const lessonStartAt = new Date(now);
    lessonStartAt.setDate(now.getDate() + 1);
    lessonStartAt.setHours(19, 0, 0, 0);
    const lessonEndAt = new Date(lessonStartAt);
    lessonEndAt.setHours(20, 0, 0, 0);

    await this.prisma.$transaction(async (tx) => {
      await this.createGuardianAccount(tx, passwordHash);
      await this.createTeacherAccount(tx, passwordHash);
      await this.createMultiRoleAccount(tx, passwordHash);

      if (
        variant !== TEST_SUPPORT_SCENARIO_VARIANTS.task1Empty.key &&
        variant !== TEST_SUPPORT_SCENARIO_VARIANTS.task2Base.key
      ) {
        await this.seedPendingPaymentBooking(tx, piano.id, {
          lessonStartAt,
          lessonEndAt,
          now,
        });
      }

      if (variant === TEST_SUPPORT_SCENARIO_VARIANTS.task1Pending.key) {
        await this.seedTeacherWorkbenchBookings(tx, piano.id, lessonStartAt);
      }

      if (variant === TEST_SUPPORT_SCENARIO_VARIANTS.task2Base.key) {
        await this.seedTask2AvailabilityBooking(tx, piano.id);
      }

      if (variant === TEST_SUPPORT_SCENARIO_VARIANTS.task3BookingCreated.key) {
        await this.seedTeacherWorkbenchBookings(tx, piano.id, lessonStartAt);
      }

      if (variant === TEST_SUPPORT_SCENARIO_VARIANTS.task4Confirmed.key) {
        await this.seedPendingPaymentBooking(tx, piano.id, {
          lessonStartAt,
          lessonEndAt,
          now,
        });
        await this.seedTeacherWorkbenchBookings(tx, piano.id, lessonStartAt);
      }

      if (variant === TEST_SUPPORT_SCENARIO_VARIANTS.task5Reschedule.key) {
        await this.seedTeacherWorkbenchBookings(tx, piano.id, lessonStartAt);
        await tx.rescheduleRequest.create({
          data: {
            bookingId: TEST_SUPPORT_BOOKINGS.confirmed.id,
            initiatorRole: PlatformRole.GUARDIAN,
            initiatorUserId: TEST_SUPPORT_ACCOUNTS.guardian.userId,
            proposedStartAt: new Date('2026-03-29T10:00:00.000Z'),
            proposedEndAt: new Date('2026-03-29T11:00:00.000Z'),
            reason: 'Task 5 固定改约样例',
            status: RescheduleRequestStatus.PENDING,
          },
        });
      }
    });
  }

  private async seedPendingPaymentBooking(
    tx: TxClient,
    subjectId: string,
    params: {
      lessonStartAt: Date;
      lessonEndAt: Date;
      now: Date;
    },
  ) {
    await tx.booking.create({
      data: {
        id: TEST_SUPPORT_BOOKINGS.pendingPayment.id,
        bookingNo: TEST_SUPPORT_BOOKINGS.pendingPayment.bookingNo,
        teacherProfileId: TEST_SUPPORT_ACCOUNTS.teacher.teacherProfileId,
        studentProfileId: TEST_SUPPORT_ACCOUNTS.guardian.studentProfileId,
        guardianProfileId: TEST_SUPPORT_ACCOUNTS.guardian.guardianProfileId,
        subjectId,
        serviceAddressId: TEST_SUPPORT_ACCOUNTS.guardian.addressId,
        startAt: params.lessonStartAt,
        endAt: params.lessonEndAt,
        timezone: 'Asia/Shanghai',
        status: BookingStatus.PENDING_PAYMENT,
        teacherAcceptedAt: params.now,
        guardianConfirmedAt: params.now,
        isTrial: true,
        hourlyRate: 200,
        durationMinutes: 60,
        subtotalAmount: 200,
        discountAmount: 0,
        platformFeeAmount: 0,
        travelFeeAmount: 0,
        totalAmount: 200,
        paymentStatus: PaymentStatus.UNPAID,
        paymentDueAt: new Date(
          params.lessonStartAt.getTime() - 2 * 60 * 60 * 1000,
        ),
        planSummary: 'Task 0 模拟支付测试单',
        notes: '用于验证开发态模拟支付与事件日志。',
      },
    });
  }

  private async seedTeacherWorkbenchBookings(
    tx: TxClient,
    subjectId: string,
    baseStartAt: Date,
  ) {
    const startPendingAcceptance = new Date(baseStartAt);
    startPendingAcceptance.setDate(startPendingAcceptance.getDate() + 1);
    const endPendingAcceptance = new Date(startPendingAcceptance);
    endPendingAcceptance.setHours(endPendingAcceptance.getHours() + 1);

    const startConfirmed = new Date(baseStartAt);
    startConfirmed.setDate(startConfirmed.getDate() + 2);
    const endConfirmed = new Date(startConfirmed);
    endConfirmed.setHours(endConfirmed.getHours() + 1);

    await tx.booking.create({
      data: {
        id: TEST_SUPPORT_BOOKINGS.pendingAcceptance.id,
        bookingNo: TEST_SUPPORT_BOOKINGS.pendingAcceptance.bookingNo,
        teacherProfileId: TEST_SUPPORT_ACCOUNTS.teacher.teacherProfileId,
        studentProfileId: TEST_SUPPORT_ACCOUNTS.guardian.studentProfileId,
        guardianProfileId: TEST_SUPPORT_ACCOUNTS.guardian.guardianProfileId,
        subjectId,
        serviceAddressId: TEST_SUPPORT_ACCOUNTS.guardian.addressId,
        startAt: startPendingAcceptance,
        endAt: endPendingAcceptance,
        timezone: 'Asia/Shanghai',
        status: BookingStatus.PENDING_ACCEPTANCE,
        isTrial: false,
        hourlyRate: 220,
        durationMinutes: 60,
        subtotalAmount: 220,
        discountAmount: 0,
        platformFeeAmount: 0,
        travelFeeAmount: 0,
        totalAmount: 220,
        paymentStatus: PaymentStatus.UNPAID,
        paymentDueAt: null,
        planSummary: 'Task 1 待接单样例',
        notes: '用于验证老师工作台待接单分组。',
      },
    });

    await tx.booking.create({
      data: {
        id: TEST_SUPPORT_BOOKINGS.confirmed.id,
        bookingNo: TEST_SUPPORT_BOOKINGS.confirmed.bookingNo,
        teacherProfileId: TEST_SUPPORT_ACCOUNTS.teacher.teacherProfileId,
        studentProfileId: TEST_SUPPORT_ACCOUNTS.guardian.studentProfileId,
        guardianProfileId: TEST_SUPPORT_ACCOUNTS.guardian.guardianProfileId,
        subjectId,
        serviceAddressId: TEST_SUPPORT_ACCOUNTS.guardian.addressId,
        startAt: startConfirmed,
        endAt: endConfirmed,
        timezone: 'Asia/Shanghai',
        status: BookingStatus.CONFIRMED,
        teacherAcceptedAt: new Date(),
        guardianConfirmedAt: new Date(),
        isTrial: false,
        hourlyRate: 220,
        durationMinutes: 60,
        subtotalAmount: 220,
        discountAmount: 0,
        platformFeeAmount: 0,
        travelFeeAmount: 0,
        totalAmount: 220,
        paymentStatus: PaymentStatus.PAID,
        paymentDueAt: null,
        planSummary: 'Task 1 已确认样例',
        notes: '用于验证老师工作台已确认分组。',
      },
    });
  }

  private async seedTask2AvailabilityBooking(tx: TxClient, subjectId: string) {
    const startAt = new Date('2026-03-25T20:00:00.000Z');
    const endAt = new Date('2026-03-25T21:00:00.000Z');

    await tx.booking.create({
      data: {
        id: TEST_SUPPORT_BOOKINGS.task2Occupied.id,
        bookingNo: TEST_SUPPORT_BOOKINGS.task2Occupied.bookingNo,
        teacherProfileId: TEST_SUPPORT_ACCOUNTS.teacher.teacherProfileId,
        studentProfileId: TEST_SUPPORT_ACCOUNTS.guardian.studentProfileId,
        guardianProfileId: TEST_SUPPORT_ACCOUNTS.guardian.guardianProfileId,
        subjectId,
        serviceAddressId: TEST_SUPPORT_ACCOUNTS.guardian.addressId,
        startAt,
        endAt,
        timezone: 'Asia/Shanghai',
        status: BookingStatus.CONFIRMED,
        teacherAcceptedAt: new Date('2026-03-22T08:00:00.000Z'),
        guardianConfirmedAt: new Date('2026-03-22T09:00:00.000Z'),
        isTrial: false,
        hourlyRate: 200,
        durationMinutes: 60,
        subtotalAmount: 200,
        discountAmount: 0,
        platformFeeAmount: 0,
        travelFeeAmount: 0,
        totalAmount: 200,
        paymentStatus: PaymentStatus.PAID,
        paymentDueAt: null,
        planSummary: 'Task 2 已占用样例课次',
        notes: '用于验证周三 20:00 时段不会再次展示。',
      },
    });
  }

  private async createGuardianAccount(tx: TxClient, passwordHash: string) {
    const guardian = TEST_SUPPORT_ACCOUNTS.guardian;

    await tx.user.create({
      data: {
        id: guardian.userId,
        name: guardian.name,
        email: guardian.email,
        phone: guardian.phone,
        phoneVerifiedAt: new Date(),
        realNameVerifiedAt: new Date(),
        realNameProvider: 'MOCK',
        realNameVerifiedName: guardian.name,
        realNameIdNumberMasked: '120***********0001',
        roles: {
          create: guardian.roles.map((role, index) => ({
            role,
            isPrimary: index == 0,
          })),
        },
        passwordCredential: {
          create: {
            passwordHash,
          },
        },
      },
    });

    await tx.address.create({
      data: {
        id: guardian.addressId,
        userId: guardian.userId,
        label: '默认上课地址',
        contactName: guardian.name,
        contactPhone: guardian.phone,
        country: 'CN',
        province: '天津市',
        city: '天津市',
        district: '南开区',
        street: '黄河道 100 号',
        building: '1 栋 1201',
        isDefault: true,
      },
    });

    await tx.guardianProfile.create({
      data: {
        id: guardian.guardianProfileId,
        userId: guardian.userId,
        displayName: guardian.name,
        phone: guardian.phone,
        onboardingCompletedAt: new Date(),
        defaultServiceAddressId: guardian.addressId,
      },
    });

    await tx.studentProfile.create({
      data: {
        id: guardian.studentProfileId,
        displayName: 'QA学员',
        gradeLevel: GradeLevel.PRIMARY,
        schoolName: '南开实验小学',
        learningGoals: '完成 Task 0 双端串测',
        specialNeeds: '无',
        onboardingCompletedAt: new Date(),
      },
    });

    await tx.studentGuardian.create({
      data: {
        studentProfileId: guardian.studentProfileId,
        guardianProfileId: guardian.guardianProfileId,
        relation: GuardianRelation.MOTHER,
        isPrimary: true,
        canBook: true,
        canViewRecords: true,
      },
    });
  }

  private async createTeacherAccount(tx: TxClient, passwordHash: string) {
    const teacher = TEST_SUPPORT_ACCOUNTS.teacher;
    const subject = await tx.subject.findUniqueOrThrow({
      where: { code: TEST_SUPPORT_SUBJECT.code },
      select: { id: true },
    });

    await tx.user.create({
      data: {
        id: teacher.userId,
        name: teacher.name,
        email: teacher.email,
        phone: teacher.phone,
        phoneVerifiedAt: new Date(),
        realNameVerifiedAt: new Date(),
        realNameProvider: 'MOCK',
        realNameVerifiedName: teacher.name,
        realNameIdNumberMasked: '120***********0002',
        roles: {
          create: teacher.roles.map((role, index) => ({
            role,
            isPrimary: index == 0,
          })),
        },
        passwordCredential: {
          create: {
            passwordHash,
          },
        },
        teacherProfile: {
          create: {
            id: teacher.teacherProfileId,
            displayName: teacher.name,
            bio: 'Task 0 老师测试账号',
            employmentType: TeacherEmploymentType.PART_TIME,
            verificationStatus: TeacherVerificationStatus.APPROVED,
            baseHourlyRate: 200,
            serviceRadiusKm: 10,
            acceptTrial: true,
            maxTravelMinutes: 45,
            timezone: 'Asia/Shanghai',
            onboardingCompletedAt: new Date(),
            subjects: {
              create: {
                subjectId: subject.id,
                hourlyRate: 200,
                trialRate: 99,
                experienceYears: 5,
                isActive: true,
              },
            },
            serviceAreas: {
              create: {
                province: '天津市',
                city: '天津市',
                district: '南开区',
                radiusKm: 10,
              },
            },
            availabilityRules: {
              createMany: {
                data: [
                  {
                    weekday: Weekday.MONDAY,
                    startMinute: 19 * 60,
                    endMinute: 21 * 60,
                    slotDurationMinutes: 60,
                    bufferMinutes: 0,
                    isActive: true,
                  },
                  {
                    weekday: Weekday.WEDNESDAY,
                    startMinute: 19 * 60,
                    endMinute: 21 * 60,
                    slotDurationMinutes: 60,
                    bufferMinutes: 0,
                    isActive: true,
                  },
                ],
              },
            },
          },
        },
      },
    });
  }

  private async createMultiRoleAccount(tx: TxClient, passwordHash: string) {
    const account = TEST_SUPPORT_ACCOUNTS.multiRole;
    const subject = await tx.subject.findUniqueOrThrow({
      where: { code: TEST_SUPPORT_SUBJECT.code },
      select: { id: true },
    });

    await tx.user.create({
      data: {
        id: account.userId,
        name: account.name,
        email: account.email,
        phone: account.phone,
        phoneVerifiedAt: new Date(),
        realNameVerifiedAt: new Date(),
        realNameProvider: 'MOCK',
        realNameVerifiedName: account.name,
        realNameIdNumberMasked: '120***********0003',
        roles: {
          create: account.roles.map((role, index) => ({
            role,
            isPrimary: index == 0,
          })),
        },
        passwordCredential: {
          create: {
            passwordHash,
          },
        },
        teacherProfile: {
          create: {
            id: account.teacherProfileId,
            displayName: '${account.name}老师',
            bio: 'Task 0 双角色切换测试账号',
            employmentType: TeacherEmploymentType.PART_TIME,
            verificationStatus: TeacherVerificationStatus.APPROVED,
            baseHourlyRate: 180,
            serviceRadiusKm: 8,
            acceptTrial: true,
            maxTravelMinutes: 45,
            timezone: 'Asia/Shanghai',
            onboardingCompletedAt: new Date(),
            subjects: {
              create: {
                subjectId: subject.id,
                hourlyRate: 180,
                trialRate: 88,
                experienceYears: 3,
                isActive: true,
              },
            },
            serviceAreas: {
              create: {
                province: '天津市',
                city: '天津市',
                district: '和平区',
                radiusKm: 8,
              },
            },
          },
        },
      },
    });

    await tx.address.create({
      data: {
        id: account.addressId,
        userId: account.userId,
        label: '双角色默认地址',
        contactName: account.name,
        contactPhone: account.phone,
        country: 'CN',
        province: '天津市',
        city: '天津市',
        district: '和平区',
        street: '南京路 66 号',
        building: '2 栋 801',
        isDefault: true,
      },
    });

    await tx.guardianProfile.create({
      data: {
        id: account.guardianProfileId,
        userId: account.userId,
        displayName: account.name,
        phone: account.phone,
        onboardingCompletedAt: new Date(),
        defaultServiceAddressId: account.addressId,
      },
    });
  }
}
