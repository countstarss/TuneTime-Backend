import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PlatformRole, Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IdentityLinkingService } from './identity-linking.service';
import { ProfileBootstrapService } from './profile-bootstrap.service';
import {
  assertPublicRequestedRole,
  assertWechatAppConfigured,
  assertWechatMiniappConfigured,
  sanitizeDisplayName,
} from './auth.utils';
import {
  WECHAT_APP_PROVIDER,
  WECHAT_MINIAPP_PROVIDER,
} from './auth.constants';

type AuthTarget = {
  userId: string;
  activeRole: PlatformRole | null;
};

type WechatAccessTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  openid?: string;
  scope?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
};

type WechatUserInfoResponse = {
  openid?: string;
  nickname?: string;
  headimgurl?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
};

type WechatMiniappSessionResponse = {
  openid?: string;
  session_key?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
};

@Injectable()
export class WechatAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identityLinkingService: IdentityLinkingService,
    private readonly profileBootstrapService: ProfileBootstrapService,
  ) {}

  async loginWithAppCode(input: {
    code: string;
    requestedRole?: PlatformRole;
  }): Promise<AuthTarget> {
    if (!input.code.trim()) {
      throw new BadRequestException('WeChat authorization code is required');
    }

    assertWechatAppConfigured();

    const appId = process.env.WECHAT_APP_APP_ID!;
    const appSecret = process.env.WECHAT_APP_SECRET!;
    const tokenPayload = await this.fetchAccessToken({
      code: input.code.trim(),
      appId,
      appSecret,
    });
    const openId = tokenPayload.openid;

    if (!openId || !tokenPayload.access_token) {
      throw new UnauthorizedException('Invalid WeChat authorization response');
    }

    const userInfo = await this.fetchUserInfo({
      accessToken: tokenPayload.access_token,
      openId,
    });
    return this.completeWechatLogin({
      provider: WECHAT_APP_PROVIDER,
      providerAppId: appId,
      providerAccountId: userInfo.unionid || tokenPayload.unionid || openId,
      unionId: userInfo.unionid || tokenPayload.unionid || null,
      openId,
      requestedRole: input.requestedRole,
      displayName: userInfo.nickname,
      avatarUrl: userInfo.headimgurl?.trim() || null,
      accessToken: tokenPayload.access_token,
      refreshToken: tokenPayload.refresh_token ?? null,
      expiresAt:
        typeof tokenPayload.expires_in === 'number'
          ? Math.floor(Date.now() / 1000) + tokenPayload.expires_in
          : null,
      scope: tokenPayload.scope ?? null,
      profileRaw: userInfo as Prisma.InputJsonValue,
    });
  }

  async loginWithMiniappCode(input: {
    code: string;
    requestedRole?: PlatformRole;
  }): Promise<AuthTarget> {
    if (!input.code.trim()) {
      throw new BadRequestException('WeChat Mini Program code is required');
    }

    assertWechatMiniappConfigured();

    const appId = process.env.WECHAT_MINIAPP_APP_ID!;
    const appSecret = process.env.WECHAT_MINIAPP_SECRET!;
    const sessionPayload = await this.fetchMiniappSession({
      code: input.code.trim(),
      appId,
      appSecret,
    });
    const openId = sessionPayload.openid;

    if (!openId) {
      throw new UnauthorizedException('Invalid WeChat Mini Program response');
    }

    return this.completeWechatLogin({
      provider: WECHAT_MINIAPP_PROVIDER,
      providerAppId: appId,
      providerAccountId: sessionPayload.unionid ?? openId,
      unionId: sessionPayload.unionid ?? null,
      openId,
      requestedRole: input.requestedRole,
      displayName: null,
      avatarUrl: null,
      profileRaw: {
        openid: openId,
        unionid: sessionPayload.unionid ?? null,
      } as Prisma.InputJsonValue,
    });
  }

  private async fetchAccessToken(input: {
    code: string;
    appId: string;
    appSecret: string;
  }): Promise<WechatAccessTokenResponse> {
    const url = new URL('https://api.weixin.qq.com/sns/oauth2/access_token');
    url.searchParams.set('appid', input.appId);
    url.searchParams.set('secret', input.appSecret);
    url.searchParams.set('code', input.code);
    url.searchParams.set('grant_type', 'authorization_code');

    const response = await fetch(url);
    if (!response.ok) {
      throw new UnauthorizedException('Failed to call WeChat access token API');
    }

    const payload = (await response.json()) as WechatAccessTokenResponse;
    if (payload.errcode) {
      throw new UnauthorizedException(
        `WeChat access token error: ${payload.errmsg ?? payload.errcode}`,
      );
    }

    return payload;
  }

  private async fetchUserInfo(input: {
    accessToken: string;
    openId: string;
  }): Promise<WechatUserInfoResponse> {
    const url = new URL('https://api.weixin.qq.com/sns/userinfo');
    url.searchParams.set('access_token', input.accessToken);
    url.searchParams.set('openid', input.openId);
    url.searchParams.set('lang', 'zh_CN');

    const response = await fetch(url);
    if (!response.ok) {
      throw new UnauthorizedException('Failed to call WeChat user info API');
    }

    const payload = (await response.json()) as WechatUserInfoResponse;
    if (payload.errcode) {
      throw new UnauthorizedException(
        `WeChat user info error: ${payload.errmsg ?? payload.errcode}`,
      );
    }

    return payload;
  }

  private async fetchMiniappSession(input: {
    code: string;
    appId: string;
    appSecret: string;
  }): Promise<WechatMiniappSessionResponse> {
    const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
    url.searchParams.set('appid', input.appId);
    url.searchParams.set('secret', input.appSecret);
    url.searchParams.set('js_code', input.code);
    url.searchParams.set('grant_type', 'authorization_code');

    const response = await fetch(url);
    if (!response.ok) {
      throw new UnauthorizedException(
        'Failed to call WeChat Mini Program session API',
      );
    }

    const payload = (await response.json()) as WechatMiniappSessionResponse;
    if (payload.errcode) {
      throw new UnauthorizedException(
        `WeChat Mini Program session error: ${payload.errmsg ?? payload.errcode}`,
      );
    }

    return payload;
  }

  private async completeWechatLogin(input: {
    provider: string;
    providerAppId: string;
    providerAccountId: string;
    unionId: string | null;
    openId: string;
    requestedRole?: PlatformRole;
    displayName?: string | null;
    avatarUrl?: string | null;
    accessToken?: string | null;
    refreshToken?: string | null;
    expiresAt?: number | null;
    scope?: string | null;
    profileRaw?: Prisma.InputJsonValue;
  }): Promise<AuthTarget> {
    const nickname = sanitizeDisplayName(input.displayName, '微信用户');
    const existingUser =
      await this.identityLinkingService.findUserByWechatIdentity({
        provider: input.provider,
        providerAccountId: input.providerAccountId,
        unionId: input.unionId,
        openId: input.openId,
      });

    let userId = existingUser?.id;
    if (!userId) {
      if (!input.requestedRole) {
        throw new BadRequestException(
          'requestedRole is required for first-time WeChat login',
        );
      }

      const createdUser = await this.identityLinkingService.createUser({
        name: nickname,
        image: input.avatarUrl ?? null,
      });
      userId = createdUser.id;
    } else if (existingUser.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User is not active');
    }

    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        image: true,
        roles: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          select: { role: true },
        },
      },
    });

    if (currentUser && (!currentUser.name || (!currentUser.image && input.avatarUrl))) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(currentUser.name ? {} : { name: nickname }),
          ...(currentUser.image || !input.avatarUrl
            ? {}
            : { image: input.avatarUrl }),
          deletedAt: null,
          status: UserStatus.ACTIVE,
        },
      });
    } else {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          deletedAt: null,
          status: UserStatus.ACTIVE,
        },
      });
    }

    await this.identityLinkingService.upsertWechatAccount(userId, {
      provider: input.provider,
      providerAppId: input.providerAppId,
      providerAccountId: input.providerAccountId,
      unionId: input.unionId,
      openId: input.openId,
      accessToken: input.accessToken ?? null,
      refreshToken: input.refreshToken ?? null,
      expiresAt: input.expiresAt ?? null,
      scope: input.scope ?? null,
      profileRaw: input.profileRaw,
    });

    let activeRole = currentUser?.roles[0]?.role ?? null;
    if (input.requestedRole) {
      const requestedRole = assertPublicRequestedRole(input.requestedRole);
      await this.profileBootstrapService.ensureRoleForUser(userId, requestedRole, {
        displayName: nickname,
      });
      await this.profileBootstrapService.setPrimaryRole(userId, requestedRole);
      activeRole = requestedRole;
    } else if (!activeRole) {
      throw new BadRequestException(
        'requestedRole is required for users without roles',
      );
    }

    return {
      userId,
      activeRole,
    };
  }
}
