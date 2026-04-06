import { getMvpCapabilities, isMvpCapabilityEnabled } from './mvp-capabilities';

describe('MVP capabilities', () => {
  it('keeps the V1 usability supplement features enabled', () => {
    expect(isMvpCapabilityEnabled('teacherDiscover')).toBe(true);
    expect(isMvpCapabilityEnabled('teacherSearch')).toBe(true);
    expect(isMvpCapabilityEnabled('teacherAvailabilityManage')).toBe(true);
    expect(isMvpCapabilityEnabled('teacherProfileManage')).toBe(true);
    expect(isMvpCapabilityEnabled('guardianProfileManage')).toBe(true);
  });

  it('returns the enabled capabilities through the public map', () => {
    const capabilities = getMvpCapabilities();

    expect(capabilities.teacherDiscover).toBe(true);
    expect(capabilities.teacherSearch).toBe(true);
    expect(capabilities.teacherAvailabilityManage).toBe(true);
    expect(capabilities.teacherProfileManage).toBe(true);
    expect(capabilities.guardianProfileManage).toBe(true);
  });
});
