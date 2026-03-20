import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PlatformRole } from '@prisma/client';
import { CurrentUser } from './current-user.decorator';
import {
  AuthCodeDispatchResponseDto,
  AuthResponseDto,
  AuthUserDto,
  BindEmailPasswordDto,
  BindPhoneConfirmDto,
  BindPhoneRequestDto,
  EmailLoginDto,
  EmailRegisterDto,
  RoleSwitchDto,
  SelfGuardianProfileUpdateDto,
  SelfStudentProfileUpdateDto,
  SelfTeacherProfileUpdateDto,
  SmsRequestCodeDto,
  SmsVerifyDto,
  WechatAppLoginDto,
} from './dto/auth.dto';
import { RequireRoles } from './require-roles.decorator';
import { RolesGuard } from './roles.guard';
import { JwtAuthGuard } from './supabase-auth.guard';
import { AuthService } from './auth.service';
import { AuthenticatedUserContext } from './auth.types';

@ApiTags('鉴权')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: '兼容旧版的邮箱注册别名' })
  @ApiOkResponse({ type: AuthResponseDto })
  async register(@Body() dto: EmailRegisterDto) {
    return this.authService.registerWithPassword(dto);
  }

  @Post('login')
  @ApiOperation({ summary: '兼容旧版的邮箱登录别名' })
  @ApiOkResponse({ type: AuthResponseDto })
  async login(@Body() dto: EmailLoginDto) {
    return this.authService.loginWithPassword(dto);
  }

  @Post('email/register')
  @ApiOperation({ summary: '邮箱注册' })
  @ApiOkResponse({ type: AuthResponseDto })
  async registerWithEmail(@Body() dto: EmailRegisterDto) {
    return this.authService.registerWithPassword(dto);
  }

  @Post('email/login')
  @ApiOperation({ summary: '邮箱登录' })
  @ApiOkResponse({ type: AuthResponseDto })
  async loginWithEmail(@Body() dto: EmailLoginDto) {
    return this.authService.loginWithPassword(dto);
  }

  @Post('sms/request-code')
  @ApiOperation({ summary: '请求短信验证码' })
  @ApiOkResponse({ type: AuthCodeDispatchResponseDto })
  async requestSmsCode(@Body() dto: SmsRequestCodeDto) {
    return this.authService.requestSmsCode(dto.phone);
  }

  @Post('sms/verify')
  @ApiOperation({ summary: '短信验证码登录/注册' })
  @ApiOkResponse({ type: AuthResponseDto })
  async verifySmsCode(@Body() dto: SmsVerifyDto) {
    return this.authService.verifySmsCode(dto);
  }

  @Post('wechat/app-login')
  @ApiOperation({ summary: '微信 App 快捷登录' })
  @ApiOkResponse({ type: AuthResponseDto })
  async loginWithWechatApp(@Body() dto: WechatAppLoginDto) {
    return this.authService.loginWithWechatApp(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '获取当前登录用户信息' })
  @ApiOkResponse({ type: AuthUserDto })
  async getMe(@CurrentUser() currentUser: AuthenticatedUserContext) {
    return this.authService.getProfileForContext(currentUser);
  }

  @UseGuards(JwtAuthGuard)
  @Post('role/switch')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '切换当前活跃身份' })
  @ApiOkResponse({ type: AuthResponseDto })
  async switchRole(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Body() dto: RoleSwitchDto,
  ) {
    return this.authService.switchRole(currentUser.userId, dto.role);
  }

  @UseGuards(JwtAuthGuard)
  @Post('bind/phone/request')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '请求绑定手机号验证码' })
  @ApiOkResponse({ type: AuthCodeDispatchResponseDto })
  async requestBindPhoneCode(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Body() dto: BindPhoneRequestDto,
  ) {
    return this.authService.requestPhoneBindCode(currentUser.userId, dto.phone);
  }

  @UseGuards(JwtAuthGuard)
  @Post('bind/phone/confirm')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '确认绑定手机号' })
  @ApiOkResponse({ type: AuthResponseDto })
  async confirmBindPhone(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Body() dto: BindPhoneConfirmDto,
  ) {
    return this.authService.confirmPhoneBind(
      currentUser.userId,
      dto.phone,
      dto.code,
      currentUser.activeRole,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('bind/email-password')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '为当前账号绑定邮箱密码' })
  @ApiOkResponse({ type: AuthResponseDto })
  async bindEmailPassword(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Body() dto: BindEmailPasswordDto,
  ) {
    return this.authService.bindEmailPassword(
      currentUser.userId,
      dto.email,
      dto.password,
      currentUser.activeRole,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRoles(PlatformRole.TEACHER)
  @Patch('self/teacher-profile')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '老师自助更新个人档案' })
  @ApiOkResponse({ type: AuthResponseDto })
  async updateTeacherProfile(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Body() dto: SelfTeacherProfileUpdateDto,
  ) {
    return this.authService.updateSelfTeacherProfile(currentUser.userId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRoles(PlatformRole.GUARDIAN)
  @Patch('self/guardian-profile')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '家长自助更新个人档案' })
  @ApiOkResponse({ type: AuthResponseDto })
  async updateGuardianProfile(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Body() dto: SelfGuardianProfileUpdateDto,
  ) {
    return this.authService.updateSelfGuardianProfile(currentUser.userId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRoles(PlatformRole.STUDENT)
  @Patch('self/student-profile')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '学生自助更新个人档案' })
  @ApiOkResponse({ type: AuthResponseDto })
  async updateStudentProfile(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Body() dto: SelfStudentProfileUpdateDto,
  ) {
    return this.authService.updateSelfStudentProfile(currentUser.userId, dto);
  }
}
