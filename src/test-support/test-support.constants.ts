import { PlatformRole } from '@prisma/client';

export const TEST_SUPPORT_PASSWORD = 'TuneTime123!';

export const TEST_SUPPORT_SUBJECT = {
  code: 'PIANO',
  name: '钢琴',
  description: 'Task 0 QA 场景默认科目',
} as const;

export const TEST_SUPPORT_ACCOUNTS = {
  guardian: {
    key: 'guardian',
    label: '家长测试账号',
    userId: 'qa_guardian_user',
    guardianProfileId: 'qa_guardian_profile',
    studentProfileId: 'qa_guardian_student_profile',
    addressId: 'qa_guardian_address',
    email: 'qa.guardian@seed.tunetime.local',
    phone: '13900000001',
    name: 'QA家长',
    roles: [PlatformRole.GUARDIAN],
    notes: '双端串测时的默认家长账号。',
  },
  teacher: {
    key: 'teacher',
    label: '老师测试账号',
    userId: 'qa_teacher_user',
    teacherProfileId: 'qa_teacher_profile',
    email: 'qa.teacher@seed.tunetime.local',
    phone: '13900000002',
    name: 'QA老师',
    roles: [PlatformRole.TEACHER],
    notes: '双端串测时的默认老师账号。',
  },
  multiRole: {
    key: 'multi_role',
    label: '双角色测试账号',
    userId: 'qa_multi_role_user',
    guardianProfileId: 'qa_multi_role_guardian_profile',
    teacherProfileId: 'qa_multi_role_teacher_profile',
    addressId: 'qa_multi_role_address',
    email: 'qa.multi@seed.tunetime.local',
    phone: '13900000003',
    name: 'QA双角色',
    roles: [PlatformRole.GUARDIAN, PlatformRole.TEACHER],
    notes: '用于验证同一账号切换家长/老师身份。',
  },
} as const;

export const TEST_SUPPORT_BOOKINGS = {
  pendingPayment: {
    key: 'pending_payment',
    id: 'qa_booking_pending_payment',
    bookingNo: 'QATASK0PAY01',
  },
} as const;
