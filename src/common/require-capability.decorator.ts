import { SetMetadata } from '@nestjs/common';
import { MvpCapability } from './mvp-capabilities';

export const REQUIRE_CAPABILITY_KEY = 'requireCapability';

export const RequireCapability = (capability: MvpCapability) =>
  SetMetadata(REQUIRE_CAPABILITY_KEY, capability);
