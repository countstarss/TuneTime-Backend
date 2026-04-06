import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureDisabledInMvpException } from './feature-disabled.exception';
import {
  isMvpCapabilityEnabled,
  MvpCapability,
} from './mvp-capabilities';
import { REQUIRE_CAPABILITY_KEY } from './require-capability.decorator';

@Injectable()
export class FeatureGateGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const capability = this.reflector.getAllAndOverride<
      MvpCapability | undefined
    >(REQUIRE_CAPABILITY_KEY, [context.getHandler(), context.getClass()]);

    if (!capability) {
      return true;
    }

    if (isMvpCapabilityEnabled(capability)) {
      return true;
    }

    throw new FeatureDisabledInMvpException(capability);
  }
}
