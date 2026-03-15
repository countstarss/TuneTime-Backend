import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { verifyJwt } from './verify-jwt';
import { AuthService } from './auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers['authorization'];
    const token =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : undefined;

    if (!token) {
      throw new UnauthorizedException('Authorization token not found');
    }

    const payload = await verifyJwt(token);

    if (!payload) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const rawPayload = payload as Record<string, unknown>;
    const userId = typeof payload.sub === 'string' ? payload.sub : undefined;
    const email = typeof payload.email === 'string' ? payload.email : undefined;
    const name = typeof payload.name === 'string' ? payload.name : undefined;
    const image =
      typeof rawPayload.picture === 'string'
        ? rawPayload.picture
        : typeof rawPayload.image === 'string'
          ? rawPayload.image
          : undefined;

    req.user = payload;

    if (userId || email) {
      await this.authService.syncUser({
        userId,
        email,
        name,
        image,
      });
    }

    return true;
  }
}
