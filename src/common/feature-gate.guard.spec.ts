import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureDisabledInMvpException } from './feature-disabled.exception';
import { FeatureGateGuard } from './feature-gate.guard';

describe('FeatureGateGuard', () => {
  const createExecutionContext = () =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
    }) as unknown as ExecutionContext;

  it('allows access when no capability metadata is set', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new FeatureGateGuard(reflector);

    expect(guard.canActivate(createExecutionContext())).toBe(true);
  });

  it('allows access when the capability is enabled', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue('smsAuth'),
    } as unknown as Reflector;
    const guard = new FeatureGateGuard(reflector);

    expect(guard.canActivate(createExecutionContext())).toBe(true);
  });

  it('blocks access when the capability is disabled', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue('calendar'),
    } as unknown as Reflector;
    const guard = new FeatureGateGuard(reflector);

    expect(() => guard.canActivate(createExecutionContext())).toThrow(
      FeatureDisabledInMvpException,
    );
  });
});
