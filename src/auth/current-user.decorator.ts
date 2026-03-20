import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUserContext } from './auth.types';

type RequestWithAuth = {
  auth?: AuthenticatedUserContext;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<RequestWithAuth>();
    return req.auth ?? null;
  },
);
