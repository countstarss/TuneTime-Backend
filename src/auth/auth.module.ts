import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtAuthGuard } from './supabase-auth.guard';
import { PasswordAuthService } from './password-auth.service';
import { SmsAuthService } from './sms-auth.service';
import { WechatAuthService } from './wechat-auth.service';
import { IdentityLinkingService } from './identity-linking.service';
import { ProfileBootstrapService } from './profile-bootstrap.service';
import { RolesGuard } from './roles.guard';
import { SmsGateway } from './sms-gateway.interface';
import { DevelopmentSmsGateway } from './development-sms.gateway';
import { TencentSmsGateway } from './tencent-sms.gateway';
import { RealNameVerificationGateway } from './real-name-verification.gateway';
import { DevelopmentRealNameGateway } from './development-real-name.gateway';
import { TencentRealNameGateway } from './tencent-real-name.gateway';
import { RealNameVerificationService } from './real-name-verification.service';

function createSmsGateway() {
  if (
    process.env.TENCENT_SMS_SECRET_ID &&
    process.env.TENCENT_SMS_SECRET_KEY &&
    process.env.TENCENT_SMS_SDK_APP_ID &&
    process.env.TENCENT_SMS_SIGN_NAME &&
    process.env.TENCENT_SMS_TEMPLATE_LOGIN
  ) {
    return new TencentSmsGateway();
  }

  return new DevelopmentSmsGateway();
}

function createRealNameVerificationGateway() {
  if (
    process.env.REAL_NAME_PROVIDER === 'TENCENT_H5' &&
    process.env.TENCENT_FACEID_SECRET_ID &&
    process.env.TENCENT_FACEID_SECRET_KEY &&
    process.env.TENCENT_FACEID_RULE_ID
  ) {
    return new TencentRealNameGateway();
  }

  return new DevelopmentRealNameGateway();
}

@Module({
  imports: [PrismaModule],
  providers: [
    AuthService,
    PasswordAuthService,
    SmsAuthService,
    WechatAuthService,
    IdentityLinkingService,
    ProfileBootstrapService,
    RealNameVerificationService,
    JwtAuthGuard,
    RolesGuard,
    {
      provide: SmsGateway,
      useFactory: createSmsGateway,
    },
    {
      provide: RealNameVerificationGateway,
      useFactory: createRealNameVerificationGateway,
    },
  ],
  controllers: [AuthController],
  exports: [AuthService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
