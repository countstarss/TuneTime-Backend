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
  assertWechatConfigured,
  sanitizeDisplayName,
} from './auth.utils';

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

    assertWechatConfigured();

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
    const unionId = userInfo.unionid || tokenPayload.unionid || null;
    const nickname = sanitizeDisplayName(userInfo.nickname, '微信用户');
    const avatarUrl = userInfo.headimgurl?.trim() || null;

    const existingUser =
      await this.identityLinkingService.findUserByWechatIdentity({
        providerAccountId: unionId ?? openId,
        unionId,
        openId,
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
        image: avatarUrl,
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

    if (currentUser && (!currentUser.name || !currentUser.image)) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(currentUser.name ? {} : { name: nickname }),
          ...(currentUser.image ? {} : { image: avatarUrl }),
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
      providerAppId: appId,
      providerAccountId: unionId ?? openId,
      unionId,
      openId,
      accessToken: tokenPayload.access_token,
      refreshToken: tokenPayload.refresh_token ?? null,
      expiresAt:
        typeof tokenPayload.expires_in === 'number'
          ? Math.floor(Date.now() / 1000) + tokenPayload.expires_in
          : null,
      scope: tokenPayload.scope ?? null,
      profileRaw: userInfo as Prisma.InputJsonValue,
    });

    let activeRole = currentUser?.roles[0]?.role ?? null;
    if (input.requestedRole) {
      const requestedRole = assertPublicRequestedRole(input.requestedRole);
      await this.profileBootstrapService.ensureRoleForUser(
        userId,
        requestedRole,
        {
          displayName: nickname,
        },
      );
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
}
