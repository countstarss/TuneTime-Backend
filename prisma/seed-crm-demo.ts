import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  BookingStatus,
  CrmActivityType,
  CrmCaseCategory,
  CrmCasePriority,
  CrmCaseStatus,
  CrmLeadStatus,
  CrmOpportunityStage,
  CrmTaskPriority,
  CrmTaskStatus,
  PlatformRole,
  PrismaClient,
} from '@prisma/client';
import { hashPassword } from '../src/auth/password.util';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('Missing DATABASE_URL');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || 'TuneTime123!';
const runTag =
  process.env.SEED_CRM_TAG ||
  `crm${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}${Math.floor(
    Math.random() * 90 + 10,
  )}`;

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickOne<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function addDays(date: Date, days: number, hour: number, minute: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  copy.setHours(hour, minute, 0, 0);
  return copy;
}

function makeId(prefix: string, index: number) {
  return `${prefix}_${runTag}_${String(index + 1).padStart(2, '0')}`;
}

async function ensureStaff() {
  const existing = await prisma.user.findMany({
    where: {
      roles: {
        some: {
          role: { in: [PlatformRole.SUPER_ADMIN, PlatformRole.ADMIN] },
        },
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
      roles: {
        select: { role: true },
        orderBy: { createdAt: 'asc' },
      },
    },
    take: 2,
    orderBy: { createdAt: 'asc' },
  });

  if (existing.length >= 2) {
    return {
      accounts: existing.map((item) => ({
        userId: item.id,
        email: item.email,
        password: DEMO_PASSWORD,
        name: item.name,
        role: item.roles[0]?.role,
      })),
      created: false,
    };
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const blueprints = [
    {
      name: `CRM 超管 ${runTag.slice(-4)}`,
      email: `superadmin.${runTag}@seed.tunetime.local`,
      phone: `169${String(randomInt(10000000, 99999999))}`,
      role: PlatformRole.SUPER_ADMIN,
    },
    {
      name: `CRM 运营 ${runTag.slice(-4)}`,
      email: `admin.${runTag}@seed.tunetime.local`,
      phone: `169${String(randomInt(10000000, 99999999))}`,
      role: PlatformRole.ADMIN,
    },
  ];

  const accounts = [] as Array<{
    userId: string;
    email: string | null;
    password: string;
    name: string | null;
    role: PlatformRole | undefined;
  }>;

  for (const blueprint of blueprints) {
    const user = await prisma.user.create({
      data: {
        name: blueprint.name,
        email: blueprint.email,
        phone: blueprint.phone,
        locale: 'zh-CN',
        timezone: 'Asia/Shanghai',
        roles: {
          create: {
            role: blueprint.role,
            isPrimary: true,
          },
        },
        passwordCredential: {
          create: {
            passwordHash,
          },
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        roles: {
          select: { role: true },
          take: 1,
        },
      },
    });

    accounts.push({
      userId: user.id,
      email: user.email,
      password: DEMO_PASSWORD,
      name: user.name,
      role: user.roles[0]?.role,
    });
  }

  return { accounts, created: true };
}

async function main() {
  await prisma.$connect();

  const staff = await ensureStaff();
  const operatorUserId = staff.accounts.find((item) => item.role === PlatformRole.ADMIN)?.userId || staff.accounts[0]?.userId;
  const approverUserId = staff.accounts.find((item) => item.role === PlatformRole.SUPER_ADMIN)?.userId || operatorUserId;

  if (!operatorUserId || !approverUserId) {
    throw new Error('No CRM staff account available');
  }

  const [subjects, guardians, students, teachers, bookings] = await Promise.all([
    prisma.subject.findMany({ select: { id: true, name: true }, take: 12, orderBy: { createdAt: 'asc' } }),
    prisma.guardianProfile.findMany({ select: { id: true, displayName: true, phone: true }, take: 12, orderBy: { createdAt: 'asc' } }),
    prisma.studentProfile.findMany({ select: { id: true, displayName: true }, take: 18, orderBy: { createdAt: 'asc' } }),
    prisma.teacherProfile.findMany({ select: { id: true, displayName: true }, take: 12, orderBy: { createdAt: 'asc' } }),
    prisma.booking.findMany({
      where: { status: { in: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED] } },
      select: {
        id: true,
        guardianProfileId: true,
        studentProfileId: true,
        teacherProfileId: true,
        subjectId: true,
        startAt: true,
      },
      take: 18,
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  if (!subjects.length || !guardians.length || !students.length || !teachers.length || !bookings.length) {
    throw new Error('Base business data is missing; run the full demo seed first');
  }

  const now = new Date();
  const leads = Array.from({ length: 12 }).map((_, index) => {
    const guardian = guardians[index % guardians.length];
    const student = students[index % students.length];
    const subject = subjects[index % subjects.length];
    const converted = index < 6;
    const status = converted
      ? pickOne([CrmLeadStatus.CONTACTED, CrmLeadStatus.QUALIFIED, CrmLeadStatus.CONVERTED])
      : pickOne([CrmLeadStatus.NEW, CrmLeadStatus.CONTACTED, CrmLeadStatus.LOST]);
    const createdAt = addDays(now, -randomInt(2, 18), 10 + (index % 6), 0);

    return {
      id: makeId('crmlead', index),
      fullName: converted ? `${guardian.displayName}家长` : `${guardian.displayName}咨询`,
      phone: guardian.phone,
      city: pickOne(['天津市', '北京市', '上海市']),
      source: pickOne(['自然咨询', '小红书', '抖音', '老带新', '公众号']),
      status,
      interestSubjectId: subject.id,
      budgetMin: randomInt(160, 260),
      budgetMax: randomInt(260, 420),
      desiredStartDate: addDays(now, randomInt(2, 15), 0, 0),
      notes: `CRM demo ${runTag} · 家长希望先安排 ${subject.name} 试听。`,
      tags: converted ? ['高意向', '需跟进'] : ['新线索'],
      ownerUserId: operatorUserId,
      convertedGuardianProfileId: converted ? guardian.id : null,
      convertedStudentProfileId: converted ? student.id : null,
      lastContactedAt: status === CrmLeadStatus.NEW ? null : addDays(createdAt, 1, 15, 0),
      createdAt,
      updatedAt: addDays(createdAt, 0, 18, 0),
    };
  });

  const opportunities = Array.from({ length: 8 }).map((_, index) => {
    const lead = leads[index % leads.length];
    const booking = bookings[index % bookings.length];
    const guardian = guardians.find((item) => item.id === booking.guardianProfileId) || guardians[index % guardians.length];
    const student = students.find((item) => item.id === booking.studentProfileId) || students[index % students.length];
    const teacher = teachers.find((item) => item.id === booking.teacherProfileId) || teachers[index % teachers.length];
    const subject = subjects.find((item) => item.id === booking.subjectId) || subjects[index % subjects.length];
    const stage = pickOne([
      CrmOpportunityStage.NEW,
      CrmOpportunityStage.QUALIFIED,
      CrmOpportunityStage.TRIAL_SCHEDULED,
      CrmOpportunityStage.TRIAL_COMPLETED,
      CrmOpportunityStage.WON,
      CrmOpportunityStage.LOST,
    ]);
    const createdAt = addDays(now, -randomInt(1, 12), 11 + (index % 4), 0);
    const lastActivityAt = addDays(createdAt, 1, 17, 0);

    return {
      id: makeId('crmopp', index),
      title: `${guardian.displayName}${subject.name}转化`,
      leadId: lead.id,
      guardianProfileId: guardian.id,
      studentProfileId: student.id,
      teacherProfileId: teacher.id,
      subjectId: subject.id,
      bookingId: stage === CrmOpportunityStage.WON || stage === CrmOpportunityStage.TRIAL_COMPLETED ? booking.id : null,
      stage,
      ownerUserId: operatorUserId,
      estimatedValue: randomInt(320, 880),
      expectedBookingAt: addDays(now, randomInt(2, 10), 18, 0),
      nextFollowUpAt: stage === CrmOpportunityStage.WON || stage === CrmOpportunityStage.LOST ? null : addDays(now, randomInt(1, 4), 14, 0),
      summary: `CRM demo ${runTag} · ${pickOne(['等待家长确认试听', '已推荐匹配老师', '家长认可上门课模式'])}`,
      lossReason: stage === CrmOpportunityStage.LOST ? pickOne(['预算不匹配', '时间不合适', '改选线下机构']) : null,
      lastActivityAt,
      createdAt,
      updatedAt: addDays(lastActivityAt, 0, 20, 0),
    };
  });

  const tasks = Array.from({ length: 10 }).map((_, index) => {
    const opportunity = opportunities[index % opportunities.length];
    const dueAt = addDays(now, index - 3, pickOne([10, 14, 18]), 0);
    const status = pickOne([CrmTaskStatus.TODO, CrmTaskStatus.IN_PROGRESS, CrmTaskStatus.DONE]);

    return {
      id: makeId('crmtask', index),
      title: pickOne(['回访试听确认', '确认家长预算', '发送课程安排', '跟进首单支付', '补充老师推荐方案']),
      description: `CRM demo ${runTag} · 跟进 ${opportunities[index % opportunities.length].title}`,
      status,
      priority: pickOne([CrmTaskPriority.MEDIUM, CrmTaskPriority.HIGH, CrmTaskPriority.URGENT]),
      leadId: opportunity.leadId,
      opportunityId: opportunity.id,
      guardianProfileId: opportunity.guardianProfileId,
      bookingId: opportunity.bookingId,
      assigneeUserId: operatorUserId,
      createdByUserId: approverUserId,
      dueAt,
      completedAt: status === CrmTaskStatus.DONE ? addDays(dueAt, 0, 20, 0) : null,
      createdAt: addDays(now, -randomInt(1, 9), 9, 0),
      updatedAt: addDays(now, -randomInt(0, 3), 18, 0),
    };
  });

  const activities = Array.from({ length: 14 }).map((_, index) => {
    const opportunity = opportunities[index % opportunities.length];
    const happenedAt = addDays(now, -randomInt(0, 7), pickOne([10, 13, 16, 20]), 0);
    return {
      id: makeId('crmact', index),
      type: pickOne([CrmActivityType.CALL, CrmActivityType.WECHAT, CrmActivityType.FOLLOW_UP, CrmActivityType.NOTE]),
      content: pickOne([
        '已和家长沟通老师风格，愿意继续推进试听。',
        '家长希望周末上课，等待老师确认档期。',
        '发送了试听方案和老师简介。',
        '家长反馈孩子更偏好钢琴老师稳定性。',
      ]),
      leadId: opportunity.leadId,
      opportunityId: opportunity.id,
      guardianProfileId: opportunity.guardianProfileId,
      bookingId: opportunity.bookingId,
      createdByUserId: operatorUserId,
      happenedAt,
      metadata: { source: 'seed-crm-demo', runTag },
      createdAt: happenedAt,
      updatedAt: happenedAt,
    };
  });

  const cases = Array.from({ length: 6 }).map((_, index) => {
    const opportunity = opportunities[index % opportunities.length];
    const category = pickOne([
      CrmCaseCategory.SCHEDULE_CHANGE,
      CrmCaseCategory.COMPLAINT,
      CrmCaseCategory.REFUND,
      CrmCaseCategory.TEACHER_CHANGE,
    ]);
    const status = pickOne([
      CrmCaseStatus.OPEN,
      CrmCaseStatus.IN_PROGRESS,
      CrmCaseStatus.WAITING_CUSTOMER,
      CrmCaseStatus.RESOLVED,
      CrmCaseStatus.CLOSED,
    ]);
    const createdAt = addDays(now, -randomInt(1, 6), 10, 0);

    return {
      id: makeId('crmcase', index),
      title: `${guardians[index % guardians.length].displayName}${pickOne(['售后跟进', '改约处理', '退款申请', '老师更换'])}`,
      description: `CRM demo ${runTag} · ${pickOne(['家长希望调整本周末上课时间', '试听后希望更换老师风格', '需要处理一次退款咨询', '课程体验后提出售后问题'])}`,
      category,
      status,
      priority: pickOne([CrmCasePriority.MEDIUM, CrmCasePriority.HIGH, CrmCasePriority.URGENT]),
      leadId: opportunity.leadId,
      opportunityId: opportunity.id,
      guardianProfileId: opportunity.guardianProfileId,
      studentProfileId: opportunity.studentProfileId,
      teacherProfileId: opportunity.teacherProfileId,
      bookingId: opportunity.bookingId,
      ownerUserId: operatorUserId,
      createdByUserId: approverUserId,
      resolutionSummary: status === CrmCaseStatus.RESOLVED || status === CrmCaseStatus.CLOSED ? '已给出处理方案，家长确认可接受。' : null,
      nextActionAt: status === CrmCaseStatus.CLOSED ? null : addDays(now, randomInt(1, 3), 15, 0),
      closedAt: status === CrmCaseStatus.CLOSED ? addDays(now, -randomInt(0, 2), 19, 0) : null,
      createdAt,
      updatedAt: addDays(createdAt, 0, 18, 0),
    };
  });

  await prisma.crmLead.createMany({ data: leads });
  await prisma.crmOpportunity.createMany({ data: opportunities });
  await prisma.crmTask.createMany({ data: tasks });
  await prisma.crmActivity.createMany({ data: activities });
  await prisma.crmCase.createMany({ data: cases });

  console.log(
    JSON.stringify(
      {
        runTag,
        counts: {
          crmLeads: leads.length,
          crmOpportunities: opportunities.length,
          crmTasks: tasks.length,
          crmActivities: activities.length,
          crmCases: cases.length,
        },
        sampleAccounts: staff.accounts.map((item) => ({
          role: item.role,
          email: item.email,
          password: item.password,
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error('CRM seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
