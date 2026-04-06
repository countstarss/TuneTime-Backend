import { ForbiddenException } from '@nestjs/common';
import { MvpCapability } from './mvp-capabilities';

export class FeatureDisabledInMvpException extends ForbiddenException {
  constructor(capability: MvpCapability) {
    super({
      code: 'FEATURE_DISABLED_IN_MVP',
      capability,
      message: `Capability "${capability}" is disabled in the V1 MVP scope.`,
    });
  }
}
