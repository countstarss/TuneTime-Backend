export const MVP_CAPABILITIES = {
  smsAuth: true,
  sessionRestore: true,
  teacherOnboarding: true,
  guardianOnboarding: true,
  bookingContext: true,
  subjects: true,
  teacherDetail: true,
  teacherAvailabilityWindows: true,
  bookingHold: true,
  bookingCreate: true,
  bookingMine: true,
  teacherWorkbench: true,
  teacherAccept: true,
  teacherProfileManage: true,
  guardianProfileManage: true,
  emailPasswordAuth: false,
  phonePasswordAuth: false,
  wechatAuth: false,
  roleSwitch: false,
  bindPhone: false,
  bindEmailPassword: false,
  passwordReset: false,
  realNameVerification: false,
  studentRole: false,
  teacherDiscover: true,
  teacherSearch: true,
  teacherAvailabilityManage: true,
  teacherAdmin: false,
  guardianAdmin: false,
  studentAdmin: false,
  addressAdmin: false,
  subjectAdmin: false,
  bookingAdmin: false,
  teacherRespond: false,
  guardianConfirm: false,
  payment: true,
  cancelBooking: false,
  reschedule: false,
  arrival: false,
  completionConfirm: false,
  dispute: false,
  manualRepair: false,
  lessons: false,
  teacherReviews: false,
  calendar: false,
  crm: false,
  testSupport: false,
  lifecycleAutomation: false,
  lessonEvidence: false,
} as const;

export type MvpCapability = keyof typeof MVP_CAPABILITIES;

const CAPABILITY_ENV_OVERRIDES: Partial<Record<MvpCapability, string>> = {
  payment: 'PAYMENT_ENABLED',
};

export function isMvpCapabilityEnabled(capability: MvpCapability): boolean {
  const overrideEnvKey = CAPABILITY_ENV_OVERRIDES[capability];
  const overrideValue = overrideEnvKey ? process.env[overrideEnvKey] : undefined;
  if (overrideValue != null) {
    return overrideValue === 'true';
  }

  return MVP_CAPABILITIES[capability];
}

export function getMvpCapabilities() {
  return Object.fromEntries(
    (Object.keys(MVP_CAPABILITIES) as MvpCapability[]).map((capability) => [
      capability,
      isMvpCapabilityEnabled(capability),
    ]),
  ) as Record<MvpCapability, boolean>;
}
