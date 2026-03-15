import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  BookingStatus,
  CredentialType,
  DocumentReviewStatus,
  GradeLevel,
  GuardianRelation,
  LessonAttendanceStatus,
  PaymentStatus,
  PlatformRole,
  PrismaClient,
  TeacherEmploymentType,
  TeacherVerificationStatus,
  Weekday,
} from '@prisma/client';
import { hashPassword } from '../src/auth/password.util';

type Area = {
  province: string;
  city: string;
  district: string;
  streetSeed: string;
  latitude: number;
  longitude: number;
};

type SubjectSeed = {
  code: string;
  name: string;
  description: string;
};

type CreatedSubject = {
  id: string;
  code: string;
  name: string;
};

type TeacherSeedRecord = {
  userId: string;
  email: string;
  password: string;
  profileId: string;
  displayName: string;
  subjects: Array<{
    subjectId: string;
    subjectCode: string;
    hourlyRate: number;
    trialRate: number | null;
    experienceYears: number;
  }>;
  areas: Area[];
};

type GuardianSeedRecord = {
  userId: string;
  email: string;
  password: string;
  profileId: string;
  displayName: string;
  phone: string;
  addressId: string;
  area: Area;
};

type StudentSeedRecord = {
  userId: string | null;
  email: string | null;
  password: string | null;
  profileId: string;
  displayName: string;
  gradeLevel: GradeLevel;
  primaryGuardianProfileId: string;
  secondaryGuardianProfileId?: string;
};

type BookingSeedRecord = {
  id: string;
  bookingNo: string;
  teacherProfileId: string;
  studentProfileId: string;
  guardianProfileId: string | null;
  status: BookingStatus;
  startAt: Date;
  endAt: Date;
};

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('Missing DATABASE_URL');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || 'TuneTime123!';
const runTag =
  process.env.SEED_DEMO_TAG ||
  `${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}${Math.floor(
    Math.random() * 90 + 10,
  )}`;
const emailDomain = 'seed.tunetime.local';
const phoneSeed = String(Math.floor(Math.random() * 9000) + 1000);
const today = new Date();

const AREAS: Area[] = [
  {
    province: '天津市',
    city: '天津市',
    district: '南开区',
    streetSeed: '黄河道',
    latitude: 39.1267,
    longitude: 117.1767,
  },
  {
    province: '天津市',
    city: '天津市',
    district: '和平区',
    streetSeed: '南京路',
    latitude: 39.1171,
    longitude: 117.2004,
  },
  {
    province: '北京市',
    city: '北京市',
    district: '朝阳区',
    streetSeed: '望京街',
    latitude: 39.9963,
    longitude: 116.4708,
  },
  {
    province: '北京市',
    city: '北京市',
    district: '海淀区',
    streetSeed: '中关村大街',
    latitude: 39.9834,
    longitude: 116.3155,
  },
  {
    province: '上海市',
    city: '上海市',
    district: '浦东新区',
    streetSeed: '张杨路',
    latitude: 31.2304,
    longitude: 121.4737,
  },
  {
    province: '上海市',
    city: '上海市',
    district: '徐汇区',
    streetSeed: '漕溪北路',
    latitude: 31.1882,
    longitude: 121.4375,
  },
];

const SUBJECTS: SubjectSeed[] = [
  { code: 'PIANO', name: '钢琴', description: '古典与流行钢琴一对一教学。' },
  { code: 'VIOLIN', name: '小提琴', description: '基础音准、持琴姿势与曲目训练。' },
  { code: 'VOCAL', name: '声乐', description: '美声与流行唱法训练。' },
  { code: 'GUITAR', name: '吉他', description: '民谣吉他与弹唱教学。' },
  { code: 'DRUMS', name: '架子鼓', description: '节奏训练与曲风演奏。' },
  { code: 'THEORY', name: '乐理', description: '视唱练耳与基础乐理。' },
];

const TEACHER_COUNT = 12;
const GUARDIAN_COUNT = 18;
const STUDENT_USER_COUNT = 18;
const STUDENT_MINOR_COUNT = 6;

const surnames = ['李', '王', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '胡', '朱'];
const teacherGiven = ['一鸣', '雨桐', '思远', '景涵', '亦辰', '清妍', '文博', '星悦', '子墨', '若溪', '嘉言', '可欣'];
const guardianGiven = ['雅琴', '秀兰', '海燕', '志强', '思敏', '雅雯', '建国', '玉梅', '晓彤', '俊杰', '欣怡', '鹏程'];
const studentGiven = ['小宇', '沐辰', '可可', '一诺', '子涵', '乐乐', '安安', '晨曦', '果果', '小满', '知夏', '星河'];
const schoolNames = ['南开实验小学', '和平中心小学', '朝阳外国语学校', '浦东新区实验学校', '徐汇音乐附中'];
const tagPool = ['耐心', '专业', '沟通好', '守时', '启发性强', '反馈细致'];
const weekdays = [Weekday.MONDAY, Weekday.TUESDAY, Weekday.WEDNESDAY, Weekday.THURSDAY, Weekday.FRIDAY, Weekday.SATURDAY, Weekday.SUNDAY];

function pickOne<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function pickMany<T>(items: T[], count: number): T[] {
  const pool = [...items];
  const picked: T[] = [];
  while (pool.length > 0 && picked.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildName(list: string[], index: number) {
  return `${surnames[index % surnames.length]}${list[index % list.length]}`;
}

function buildEmail(role: string, index: number) {
  return `${role}.${runTag}.${String(index + 1).padStart(3, '0')}@${emailDomain}`;
}

function buildPhone(prefix: string, index: number) {
  return `${prefix}${phoneSeed}${String(index + 1).padStart(4, '0')}`;
}

function buildStreet(area: Area, index: number) {
  return `${area.streetSeed}${randomInt(10, 180)}号`;
}

function addDays(date: Date, days: number, hour: number, minute: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  copy.setHours(hour, minute, 0, 0);
  return copy;
}

function overlaps(startAt: Date, endAt: Date, slots: Array<{ startAt: Date; endAt: Date }>) {
  return slots.some((slot) => startAt < slot.endAt && endAt > slot.startAt);
}

function buildBookingNo(index: number) {
  return `DM${runTag.slice(-8)}${String(index + 1).padStart(4, '0')}`;
}

async function ensureSubjects(): Promise<CreatedSubject[]> {
  const subjects: CreatedSubject[] = [];
  for (const subject of SUBJECTS) {
    const record = await prisma.subject.upsert({
      where: { code: subject.code },
      create: {
        code: subject.code,
        name: subject.name,
        description: subject.description,
        isActive: true,
      },
      update: {
        name: subject.name,
        description: subject.description,
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });
    subjects.push(record);
  }
  return subjects;
}

async function createUserWithRole(input: {
  name: string;
  email: string;
  phone: string;
  role: PlatformRole;
  passwordHash: string;
}) {
  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      locale: 'zh-CN',
      timezone: 'Asia/Shanghai',
      roles: {
        create: {
          role: input.role,
          isPrimary: true,
        },
      },
      passwordCredential: {
        create: {
          passwordHash: input.passwordHash,
        },
      },
    },
    select: {
      id: true,
      email: true,
    },
  });
}

async function seedTeachers(subjects: CreatedSubject[], passwordHash: string) {
  const teachers: TeacherSeedRecord[] = [];
  for (let index = 0; index < TEACHER_COUNT; index += 1) {
    const name = `${buildName(teacherGiven, index)}老师`;
    const user = await createUserWithRole({
      name,
      email: buildEmail('teacher', index),
      phone: buildPhone('166', index),
      role: PlatformRole.TEACHER,
      passwordHash,
    });

    const teacherProfile = await prisma.teacherProfile.create({
      data: {
        userId: user.id,
        displayName: name,
        bio: `${name}擅长${pickOne(subjects).name}启蒙、基本功训练与阶段性考级辅导。`,
        employmentType:
          index % 3 === 0 ? TeacherEmploymentType.FULL_TIME : TeacherEmploymentType.PART_TIME,
        verificationStatus: TeacherVerificationStatus.APPROVED,
        baseHourlyRate: randomInt(160, 320),
        serviceRadiusKm: randomInt(5, 15),
        acceptTrial: index % 4 !== 0,
        maxTravelMinutes: randomInt(30, 80),
        agreementAcceptedAt: addDays(today, -randomInt(30, 180), 10, 0),
        agreementVersion: 'v1.0.0',
        interviewedAt: addDays(today, -randomInt(30, 180), 14, 0),
        interviewNotes: '演示数据：面试通过，适合上门课场景。',
        onboardingCompletedAt: addDays(today, -randomInt(20, 120), 18, 0),
      },
      select: {
        id: true,
        displayName: true,
      },
    });

    const chosenSubjects = pickMany(subjects, randomInt(2, 3));
    const subjectRecords = chosenSubjects.map((subject) => ({
      teacherProfileId: teacherProfile.id,
      subjectId: subject.id,
      hourlyRate: randomInt(160, 320),
      trialRate: Math.random() > 0.35 ? randomInt(88, 158) : null,
      experienceYears: randomInt(2, 12),
      isActive: true,
    }));
    await prisma.teacherSubject.createMany({ data: subjectRecords });

    const chosenAreas = pickMany(AREAS, randomInt(1, 2));
    await prisma.teacherServiceArea.createMany({
      data: chosenAreas.map((area) => ({
        teacherProfileId: teacherProfile.id,
        province: area.province,
        city: area.city,
        district: area.district,
        radiusKm: randomInt(6, 12),
      })),
    });

    await prisma.teacherAvailabilityRule.createMany({
      data: pickMany(weekdays, 2).map((weekday, weekdayIndex) => ({
        teacherProfileId: teacherProfile.id,
        weekday,
        startMinute: weekdayIndex === 0 ? 540 : 840,
        endMinute: weekdayIndex === 0 ? 720 : 1080,
        slotDurationMinutes: 60,
        bufferMinutes: 15,
        isActive: true,
        effectiveFrom: addDays(today, -60, 0, 0),
        effectiveTo: addDays(today, 180, 0, 0),
      })),
    });

    await prisma.teacherCredential.createMany({
      data: [
        {
          teacherProfileId: teacherProfile.id,
          credentialType: CredentialType.ID_CARD,
          name: '身份证明',
          fileUrl: `https://seed.tunetime.local/${runTag}/teacher-${index + 1}-id-card.pdf`,
          reviewStatus: DocumentReviewStatus.APPROVED,
          reviewNotes: '演示数据：审核通过',
        },
        {
          teacherProfileId: teacherProfile.id,
          credentialType: CredentialType.NO_CRIMINAL_RECORD,
          name: '无犯罪记录证明',
          fileUrl: `https://seed.tunetime.local/${runTag}/teacher-${index + 1}-record.pdf`,
          reviewStatus: DocumentReviewStatus.APPROVED,
          reviewNotes: '演示数据：审核通过',
        },
      ],
    });

    teachers.push({
      userId: user.id,
      email: user.email ?? '',
      password: DEMO_PASSWORD,
      profileId: teacherProfile.id,
      displayName: teacherProfile.displayName,
      subjects: subjectRecords.map((record) => ({
        subjectId: record.subjectId,
        subjectCode: chosenSubjects.find((item) => item.id === record.subjectId)?.code || '',
        hourlyRate: Number(record.hourlyRate),
        trialRate: record.trialRate,
        experienceYears: record.experienceYears,
      })),
      areas: chosenAreas,
    });
  }
  return teachers;
}

async function seedGuardians(passwordHash: string) {
  const guardians: GuardianSeedRecord[] = [];
  for (let index = 0; index < GUARDIAN_COUNT; index += 1) {
    const name = buildName(guardianGiven, index);
    const phone = buildPhone('167', index);
    const user = await createUserWithRole({
      name,
      email: buildEmail('guardian', index),
      phone,
      role: PlatformRole.GUARDIAN,
      passwordHash,
    });

    const guardianProfile = await prisma.guardianProfile.create({
      data: {
        userId: user.id,
        displayName: name,
        phone,
        emergencyContactName: `${name}家属`,
        emergencyContactPhone: phone,
      },
      select: { id: true, displayName: true },
    });

    const area = AREAS[index % AREAS.length];
    const address = await prisma.address.create({
      data: {
        userId: user.id,
        label: index % 2 === 0 ? '家里' : '陪练地址',
        contactName: name,
        contactPhone: phone,
        province: area.province,
        city: area.city,
        district: area.district,
        street: buildStreet(area, index),
        building: `${randomInt(1, 12)}号楼${randomInt(1, 3)}单元${randomInt(101, 2602)}`,
        latitude: area.latitude + index * 0.0003,
        longitude: area.longitude + index * 0.0003,
        isDefault: true,
      },
      select: { id: true },
    });

    await prisma.guardianProfile.update({
      where: { id: guardianProfile.id },
      data: { defaultServiceAddressId: address.id },
    });

    guardians.push({
      userId: user.id,
      email: user.email ?? '',
      password: DEMO_PASSWORD,
      profileId: guardianProfile.id,
      displayName: guardianProfile.displayName,
      phone,
      addressId: address.id,
      area,
    });
  }
  return guardians;
}

async function seedStudents(passwordHash: string, guardians: GuardianSeedRecord[]) {
  const students: StudentSeedRecord[] = [];

  for (let index = 0; index < STUDENT_USER_COUNT; index += 1) {
    const name = buildName(studentGiven, index);
    const user = await createUserWithRole({
      name,
      email: buildEmail('student', index),
      phone: buildPhone('168', index),
      role: PlatformRole.STUDENT,
      passwordHash,
    });

    const primaryGuardian = guardians[index % guardians.length];
    const secondaryGuardian = Math.random() > 0.7 ? guardians[(index + 3) % guardians.length] : undefined;

    const studentProfile = await prisma.studentProfile.create({
      data: {
        userId: user.id,
        displayName: name,
        gradeLevel: pickOne([
          GradeLevel.KINDERGARTEN,
          GradeLevel.PRIMARY,
          GradeLevel.MIDDLE,
          GradeLevel.HIGH,
        ]),
        dateOfBirth: addDays(today, -randomInt(8 * 365, 16 * 365), 0, 0),
        schoolName: pickOne(schoolNames),
        learningGoals: pickOne([
          '希望培养节奏感与乐感',
          '准备参加校内音乐演出',
          '想系统完成启蒙阶段训练',
          '希望提升考级曲目表现力',
        ]),
        specialNeeds: Math.random() > 0.8 ? '希望老师加强课后反馈' : null,
      },
      select: { id: true, displayName: true, gradeLevel: true },
    });

    await prisma.studentGuardian.create({
      data: {
        studentProfileId: studentProfile.id,
        guardianProfileId: primaryGuardian.profileId,
        relation: pickOne([GuardianRelation.FATHER, GuardianRelation.MOTHER]),
        isPrimary: true,
        canBook: true,
        canViewRecords: true,
      },
    });

    if (secondaryGuardian && secondaryGuardian.profileId !== primaryGuardian.profileId) {
      await prisma.studentGuardian.create({
        data: {
          studentProfileId: studentProfile.id,
          guardianProfileId: secondaryGuardian.profileId,
          relation: GuardianRelation.OTHER,
          isPrimary: false,
          canBook: Math.random() > 0.4,
          canViewRecords: true,
        },
      });
    }

    students.push({
      userId: user.id,
      email: user.email ?? '',
      password: DEMO_PASSWORD,
      profileId: studentProfile.id,
      displayName: studentProfile.displayName,
      gradeLevel: studentProfile.gradeLevel,
      primaryGuardianProfileId: primaryGuardian.profileId,
      secondaryGuardianProfileId: secondaryGuardian?.profileId,
    });
  }

  for (let index = 0; index < STUDENT_MINOR_COUNT; index += 1) {
    const name = `演示学生${index + 1}`;
    const primaryGuardian = guardians[(index + 6) % guardians.length];
    const studentProfile = await prisma.studentProfile.create({
      data: {
        displayName: name,
        gradeLevel: pickOne([GradeLevel.KINDERGARTEN, GradeLevel.PRIMARY]),
        dateOfBirth: addDays(today, -randomInt(5 * 365, 9 * 365), 0, 0),
        schoolName: pickOne(schoolNames),
        learningGoals: '希望建立稳定练习习惯',
      },
      select: { id: true, displayName: true, gradeLevel: true },
    });

    await prisma.studentGuardian.create({
      data: {
        studentProfileId: studentProfile.id,
        guardianProfileId: primaryGuardian.profileId,
        relation: pickOne([GuardianRelation.FATHER, GuardianRelation.MOTHER]),
        isPrimary: true,
        canBook: true,
        canViewRecords: true,
      },
    });

    students.push({
      userId: null,
      email: null,
      password: null,
      profileId: studentProfile.id,
      displayName: studentProfile.displayName,
      gradeLevel: studentProfile.gradeLevel,
      primaryGuardianProfileId: primaryGuardian.profileId,
    });
  }

  return students;
}

async function seedBookings(input: {
  teachers: TeacherSeedRecord[];
  guardians: GuardianSeedRecord[];
  students: StudentSeedRecord[];
}) {
  const teacherSchedules = new Map<string, Array<{ startAt: Date; endAt: Date }>>();
  const studentSchedules = new Map<string, Array<{ startAt: Date; endAt: Date }>>();
  const bookings: BookingSeedRecord[] = [];

  const bookingPlans = [
    { count: 12, status: BookingStatus.COMPLETED },
    { count: 2, status: BookingStatus.IN_PROGRESS },
    { count: 8, status: BookingStatus.CONFIRMED },
    { count: 6, status: BookingStatus.PENDING_PAYMENT },
    { count: 6, status: BookingStatus.PENDING_ACCEPTANCE },
    { count: 4, status: BookingStatus.CANCELLED },
  ] as const;

  let bookingIndex = 0;

  for (const plan of bookingPlans) {
    for (let index = 0; index < plan.count; index += 1) {
      const student = input.students[(bookingIndex + index) % input.students.length];
      const guardian =
        input.guardians.find((item) => item.profileId === student.primaryGuardianProfileId) ||
        input.guardians[0];
      const area = guardian.area;
      const teacherCandidates = input.teachers.filter((teacher) =>
        teacher.areas.some(
          (teacherArea) =>
            teacherArea.city === area.city && teacherArea.district === area.district,
        ),
      );
      const teacher = pickOne(teacherCandidates.length ? teacherCandidates : input.teachers);
      const subject = pickOne(teacher.subjects);
      const durationMinutes = pickOne([60, 60, 90]);
      const isTrial = Math.random() > 0.75 && subject.trialRate !== null;
      const hourlyRate = isTrial ? subject.trialRate ?? subject.hourlyRate : subject.hourlyRate;

      let startAt = today;
      let endAt = today;
      let attempts = 0;
      do {
        if (plan.status === BookingStatus.IN_PROGRESS) {
          startAt = addDays(today, 0, today.getHours() - 1, 0);
        } else if (plan.status === BookingStatus.COMPLETED) {
          startAt = addDays(today, -randomInt(3, 35), pickOne([9, 10, 14, 16, 18]), 0);
        } else if (plan.status === BookingStatus.CANCELLED) {
          startAt = addDays(today, randomInt(1, 15), pickOne([9, 11, 15, 18]), 0);
        } else {
          startAt = addDays(today, randomInt(1, 20), pickOne([9, 10, 13, 15, 18]), 0);
        }
        endAt = new Date(startAt.getTime() + durationMinutes * 60000);
        attempts += 1;
      } while (
        attempts < 20 &&
        (overlaps(startAt, endAt, teacherSchedules.get(teacher.profileId) || []) ||
          overlaps(startAt, endAt, studentSchedules.get(student.profileId) || []))
      );

      teacherSchedules.set(teacher.profileId, [
        ...(teacherSchedules.get(teacher.profileId) || []),
        { startAt, endAt },
      ]);
      studentSchedules.set(student.profileId, [
        ...(studentSchedules.get(student.profileId) || []),
        { startAt, endAt },
      ]);

      const discountAmount = isTrial ? randomInt(0, 20) : pickOne([0, 0, 10, 20]);
      const platformFeeAmount = pickOne([0, 8, 12]);
      const travelFeeAmount = pickOne([0, 10, 20, 30]);
      const subtotalAmount = Number(((hourlyRate * durationMinutes) / 60).toFixed(2));
      const totalAmount = Number(
        (subtotalAmount - discountAmount + platformFeeAmount + travelFeeAmount).toFixed(2),
      );

      const paymentStatus =
        plan.status === BookingStatus.PENDING_ACCEPTANCE ||
        plan.status === BookingStatus.PENDING_PAYMENT ||
        plan.status === BookingStatus.CANCELLED
          ? PaymentStatus.UNPAID
          : PaymentStatus.PAID;

      const booking = await prisma.booking.create({
        data: {
          bookingNo: buildBookingNo(bookingIndex),
          teacherProfileId: teacher.profileId,
          studentProfileId: student.profileId,
          guardianProfileId: guardian.profileId,
          subjectId: subject.subjectId,
          serviceAddressId: guardian.addressId,
          startAt,
          endAt,
          timezone: 'Asia/Shanghai',
          status: plan.status,
          cancellationReason:
            plan.status === BookingStatus.CANCELLED ? 'STUDENT_REQUEST' : null,
          cancelledAt:
            plan.status === BookingStatus.CANCELLED ? addDays(today, 0, 12, 0) : null,
          cancelledByUserId:
            plan.status === BookingStatus.CANCELLED ? guardian.userId : null,
          isTrial,
          teacherAcceptedAt:
            plan.status === BookingStatus.PENDING_ACCEPTANCE
              ? null
              : new Date(startAt.getTime() - 2 * 24 * 60 * 60000),
          guardianConfirmedAt:
            plan.status === BookingStatus.COMPLETED ||
            plan.status === BookingStatus.CONFIRMED ||
            plan.status === BookingStatus.IN_PROGRESS
              ? new Date(startAt.getTime() - 24 * 60 * 60000)
              : null,
          hourlyRate,
          durationMinutes,
          subtotalAmount,
          discountAmount,
          platformFeeAmount,
          travelFeeAmount,
          totalAmount,
          paymentStatus,
          paymentDueAt:
            paymentStatus === PaymentStatus.UNPAID
              ? new Date(startAt.getTime() - 24 * 60 * 60000)
              : null,
          planSummary: `${teacher.displayName}负责本次${subject.subjectCode}课程，重点关注基础节奏与手型。`,
          notes: `演示数据 ${runTag}`,
        },
        select: {
          id: true,
          bookingNo: true,
          teacherProfileId: true,
          studentProfileId: true,
          guardianProfileId: true,
          status: true,
          startAt: true,
          endAt: true,
        },
      });

      bookings.push(booking);
      bookingIndex += 1;
    }
  }

  return bookings;
}

async function seedLessonsAndReviews(input: {
  bookings: BookingSeedRecord[];
  teachers: TeacherSeedRecord[];
}) {
  let lessonCount = 0;
  let reviewCount = 0;

  const completedBookings = input.bookings.filter(
    (booking) => booking.status === BookingStatus.COMPLETED,
  );
  const inProgressBookings = input.bookings.filter(
    (booking) => booking.status === BookingStatus.IN_PROGRESS,
  );
  const confirmedBookings = input.bookings.filter(
    (booking) => booking.status === BookingStatus.CONFIRMED,
  );

  for (const booking of completedBookings) {
    await prisma.lesson.create({
      data: {
        bookingId: booking.id,
        teacherProfileId: booking.teacherProfileId,
        studentProfileId: booking.studentProfileId,
        attendanceStatus: LessonAttendanceStatus.COMPLETED,
        checkInAt: new Date(booking.startAt.getTime() - 5 * 60000),
        checkInLatitude: 39.1267,
        checkInLongitude: 117.2059,
        checkInAddress: '演示签到地址',
        startedAt: booking.startAt,
        endedAt: booking.endAt,
        checkOutAt: new Date(booking.endAt.getTime() + 5 * 60000),
        checkOutLatitude: 39.1269,
        checkOutLongitude: 117.2061,
        checkOutAddress: '演示签退地址',
        teacherSummary: '本节课完成基础节奏训练与曲目拆分。',
        homework: '请在下次课前完成指定练习 2 组。',
        outcomeVideoUrl: `https://seed.tunetime.local/${runTag}/lesson-${lessonCount + 1}.mp4`,
        feedbackSubmittedAt: new Date(booking.endAt.getTime() + 2 * 60 * 60000),
        guardianFeedback: '孩子反馈老师讲解清晰，愿意继续练习。',
      },
    });
    lessonCount += 1;
  }

  for (const booking of inProgressBookings) {
    await prisma.lesson.create({
      data: {
        bookingId: booking.id,
        teacherProfileId: booking.teacherProfileId,
        studentProfileId: booking.studentProfileId,
        attendanceStatus: LessonAttendanceStatus.ONGOING,
        checkInAt: new Date(booking.startAt.getTime() - 5 * 60000),
        checkInLatitude: 39.1267,
        checkInLongitude: 117.2059,
        checkInAddress: '演示签到地址',
        startedAt: booking.startAt,
      },
    });
    lessonCount += 1;
  }

  for (const booking of confirmedBookings.slice(0, 4)) {
    await prisma.lesson.create({
      data: {
        bookingId: booking.id,
        teacherProfileId: booking.teacherProfileId,
        studentProfileId: booking.studentProfileId,
        attendanceStatus: LessonAttendanceStatus.SCHEDULED,
      },
    });
    lessonCount += 1;
  }

  for (const booking of completedBookings.slice(0, 8)) {
    const rating = pickOne([4, 4, 5, 5, 5]);
    const lessonQualityRating = pickOne([4, 5, 5]);
    const teacherPerformanceRating = pickOne([4, 4, 5, 5]);
    await prisma.teacherReview.create({
      data: {
        bookingId: booking.id,
        teacherProfileId: booking.teacherProfileId,
        studentProfileId: booking.studentProfileId,
        guardianProfileId: booking.guardianProfileId,
        rating,
        lessonQualityRating,
        teacherPerformanceRating,
        comment: '演示数据：老师上课节奏稳定，反馈清晰。',
        improvementNotes: '可以继续加强节奏练习环节。',
        tags: pickMany(tagPool, 2),
      },
    });
    reviewCount += 1;
  }

  const completedLessonMap = new Map<string, number>();
  for (const booking of completedBookings) {
    completedLessonMap.set(
      booking.teacherProfileId,
      (completedLessonMap.get(booking.teacherProfileId) || 0) + 1,
    );
  }

  const reviews = await prisma.teacherReview.findMany({
    select: {
      teacherProfileId: true,
      rating: true,
    },
  });
  const reviewStats = new Map<string, { total: number; count: number }>();
  for (const review of reviews) {
    const current = reviewStats.get(review.teacherProfileId) || { total: 0, count: 0 };
    current.total += review.rating;
    current.count += 1;
    reviewStats.set(review.teacherProfileId, current);
  }

  for (const teacher of input.teachers) {
    const reviewStat = reviewStats.get(teacher.profileId) || { total: 0, count: 0 };
    const totalCompletedLessons = completedLessonMap.get(teacher.profileId) || 0;
    await prisma.teacherProfile.update({
      where: { id: teacher.profileId },
      data: {
        ratingAvg: reviewStat.count ? Number((reviewStat.total / reviewStat.count).toFixed(2)) : 0,
        ratingCount: reviewStat.count,
        totalCompletedLessons,
      },
    });
  }

  return { lessonCount, reviewCount };
}

async function main() {
  await prisma.$connect();

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const subjects = await ensureSubjects();
  const teachers = await seedTeachers(subjects, passwordHash);
  const guardians = await seedGuardians(passwordHash);
  const students = await seedStudents(passwordHash, guardians);
  const bookings = await seedBookings({ teachers, guardians, students });
  const { lessonCount, reviewCount } = await seedLessonsAndReviews({ bookings, teachers });

  const summary = {
    runTag,
    password: DEMO_PASSWORD,
    counts: {
      users: TEACHER_COUNT + GUARDIAN_COUNT + STUDENT_USER_COUNT,
      teachers: teachers.length,
      guardians: guardians.length,
      students: students.length,
      bookings: bookings.length,
      lessons: lessonCount,
      reviews: reviewCount,
      subjects: subjects.length,
    },
    sampleAccounts: {
      teacher: {
        email: teachers[0]?.email,
        password: teachers[0]?.password,
      },
      guardian: {
        email: guardians[0]?.email,
        password: guardians[0]?.password,
      },
      student: {
        email: students.find((item) => item.email)?.email,
        password: students.find((item) => item.email)?.password,
      },
    },
  };

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
