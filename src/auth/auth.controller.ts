import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiExcludeEndpoint,
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
  SelfBookingContextDto,
  AuthUserDto,
  BindEmailPasswordDto,
  BindPhoneConfirmDto,
  BindPhoneRequestDto,
  CompleteMockRealNameVerificationDto,
  EmailLoginDto,
  EmailRegisterDto,
  PhonePasswordLoginDto,
  RealNameVerificationSessionDto,
  RealNameVerificationSessionRequestDto,
  ResetPasswordWithSmsDto,
  RoleSwitchDto,
  SelfGuardianOnboardingUpdateDto,
  SelfGuardianStudentCreateDto,
  SelfGuardianStudentUpdateDto,
  SelfGuardianAddressCreateDto,
  SelfGuardianAddressUpdateDto,
  SelfGuardianProfileUpdateDto,
  SelfStudentOnboardingUpdateDto,
  SelfStudentProfileUpdateDto,
  SelfTeacherOnboardingUpdateDto,
  SelfTeacherProfileUpdateDto,
  SmsRequestCodeDto,
  SmsVerifyDto,
  WechatAppLoginDto,
  WechatMiniappLoginDto,
} from './dto/auth.dto';
import { StudentResponseDto } from '../students/dto/student-response.dto';
import { AddressResponseDto } from '../addresses/dto/address-response.dto';
import { RequireCapability } from '../common/require-capability.decorator';
import { RequireRoles } from './require-roles.decorator';
import { RolesGuard } from './roles.guard';
import { JwtAuthGuard } from './supabase-auth.guard';
import { AuthService } from './auth.service';
import { AuthenticatedUserContext } from './auth.types';

@ApiTags('鉴权')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // @post-mvp: 邮箱密码注册在 V1 默认关闭。
  @Post('register')
  @RequireCapability('emailPasswordAuth')
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: '兼容旧版的邮箱注册别名' })
  @ApiOkResponse({ type: AuthResponseDto })
  async register(@Body() dto: EmailRegisterDto) {
    return this.authService.registerWithPassword(dto);
  }

  // @post-mvp: 邮箱密码登录在 V1 默认关闭。
  @Post('login')
  @RequireCapability('emailPasswordAuth')
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: '兼容旧版的邮箱登录别名' })
  @ApiOkResponse({ type: AuthResponseDto })
  async login(@Body() dto: EmailLoginDto) {
    return this.authService.loginWithPassword(dto);
  }

  // @post-mvp: 邮箱密码注册在 V1 默认关闭。
  @Post('email/register')
  @RequireCapability('emailPasswordAuth')
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: '邮箱注册' })
  @ApiOkResponse({ type: AuthResponseDto })
  async registerWithEmail(@Body() dto: EmailRegisterDto) {
    return this.authService.registerWithPassword(dto);
  }

  // @post-mvp: 邮箱密码登录在 V1 默认关闭。
  @Post('email/login')
  @RequireCapability('emailPasswordAuth')
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: '邮箱登录' })
  @ApiOkResponse({ type: AuthResponseDto })
  async loginWithEmail(@Body() dto: EmailLoginDto) {
    return this.authService.loginWithPassword(dto);
  }

  // @post-mvp: 手机号密码登录在 V1 默认关闭。
  @Post('phone-password/login')
  @RequireCapability('phonePasswordAuth')
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: '手机号密码登录' })
  @ApiOkResponse({ type: AuthResponseDto })
  async loginWithPhonePassword(@Body() dto: PhonePasswordLoginDto) {
    return this.authService.loginWithPhonePassword(dto);
  }

  @Post('sms/request-code')
  @RequireCapability('smsAuth')
  @ApiOperation({ summary: '请求短信验证码' })
  @ApiOkResponse({ type: AuthCodeDispatchResponseDto })
  async requestSmsCode(@Body() dto: SmsRequestCodeDto) {
    return this.authService.requestSmsCode(dto.phone);
  }

  @Post('sms/verify')
  @RequireCapability('smsAuth')
  @ApiOperation({ summary: '短信验证码登录/注册' })
  @ApiOkResponse({ type: AuthResponseDto })
  async verifySmsCode(@Body() dto: SmsVerifyDto) {
    return this.authService.verifySmsCode(dto);
  }

  // @post-mvp: 微信登录在 V1 默认关闭。
  @Post('wechat/app-login')
  @RequireCapability('wechatAuth')
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: '微信 App 快捷登录' })
  @ApiOkResponse({ type: AuthResponseDto })
  async loginWithWechatApp(@Body() dto: WechatAppLoginDto) {
    return this.authService.loginWithWechatApp(dto);
  }

  // @post-mvp: 微信登录在 V1 默认关闭。
  @Post('wechat/miniapp-login')
  @RequireCapability('wechatAuth')
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: '微信小程序快捷登录' })
  @ApiOkResponse({ type: AuthResponseDto })
  async loginWithWechatMiniapp(@Body() dto: WechatMiniappLoginDto) {
    return this.authService.loginWithWechatMiniapp(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @RequireCapability('sessionRestore')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '获取当前登录用户信息' })
  @ApiOkResponse({ type: AuthUserDto })
  async getMe(@CurrentUser() currentUser: AuthenticatedUserContext) {
    return this.authService.getProfileForContext(currentUser);
  }

  @UseGuards(JwtAuthGuard)
  @Get('self/booking-context')
  @RequireCapability('bookingContext')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '获取当前账号的约课上下文' })
  @ApiOkResponse({ type: SelfBookingContextDto })
  async getSelfBookingContext(
    @CurrentUser() currentUser: AuthenticatedUserContext,
  ) {
    return this.authService.getSelfBookingContext(currentUser.userId);
  }

  // @post-mvp: 家长多孩子管理保留实现，但 V1 默认关闭。
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireCapability('guardianProfileManage')
  @RequireRoles(PlatformRole.GUARDIAN)
  @Get('self/guardian/students')
  @ApiExcludeEndpoint()
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '获取当前家长名下的孩子资料列表' })
  @ApiOkResponse({ type: StudentResponseDto, isArray: true })
  async listSelfGuardianStudents(
    @CurrentUser() currentUser: AuthenticatedUserContext,
  ) {
    return this.authService.listSelfGuardianStudents(currentUser.userId);
  }

  // @post-mvp: 家长多孩子管理保留实现，但 V1 默认关闭。
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireCapability('guardianProfileManage')
  @RequireRoles(PlatformRole.GUARDIAN)
  @Post('self/guardian/students')
  @ApiExcludeEndpoint()
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '为当前家长新增孩子资料' })
  @ApiOkResponse({ type: StudentResponseDto })
  async createSelfGuardianStudent(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Body() dto: SelfGuardianStudentCreateDto,
  ) {
    return this.authService.createSelfGuardianStudent(currentUser.userId, dto);
  }

  // @post-mvp: 家长多孩子管理保留实现，但 V1 默认关闭。
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireCapability('guardianProfileManage')
  @RequireRoles(PlatformRole.GUARDIAN)
  @Patch('self/guardian/students/:studentId')
  @ApiExcludeEndpoint()
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '更新当前家长名下的孩子资料' })
  @ApiOkResponse({ type: StudentResponseDto })
  async updateSelfGuardianStudent(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Param('studentId') studentId: string,
    @Body() dto: SelfGuardianStudentUpdateDto,
  ) {
    return this.authService.updateSelfGuardianStudent(
      currentUser.userId,
      studentId,
      dto,
    );
  }

  // @post-mvp: 家长多地址管理保留实现，但 V1 默认关闭。
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireCapability('guardianProfileManage')
  @RequireRoles(PlatformRole.GUARDIAN)
  @Get('self/guardian/addresses')
  @ApiExcludeEndpoint()
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '获取当前家长的地址列表' })
  @ApiOkResponse({ type: AddressResponseDto, isArray: true })
  async listSelfGuardianAddresses(
    @CurrentUser() currentUser: AuthenticatedUserContext,
  ) {
    return this.authService.listSelfGuardianAddresses(currentUser.userId);
  }

  // @post-mvp: 家长多地址管理保留实现，但 V1 默认关闭。
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireCapability('guardianProfileManage')
  @RequireRoles(PlatformRole.GUARDIAN)
  @Post('self/guardian/addresses')
  @ApiExcludeEndpoint()
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '为当前家长新增上课地址' })
  @ApiOkResponse({ type: AddressResponseDto })
  async createSelfGuardianAddress(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Body() dto: SelfGuardianAddressCreateDto,
  ) {
    return this.authService.createSelfGuardianAddress(currentUser.userId, dto);
  }

  // @post-mvp: 家长多地址管理保留实现，但 V1 默认关闭。
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireCapability('guardianProfileManage')
  @RequireRoles(PlatformRole.GUARDIAN)
  @Patch('self/guardian/addresses/:addressId')
  @ApiExcludeEndpoint()
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '更新当前家长的上课地址' })
  @ApiOkResponse({ type: AddressResponseDto })
  async updateSelfGuardianAddress(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Param('addressId') addressId: string,
    @Body() dto: SelfGuardianAddressUpdateDto,
  ) {
    return this.authService.updateSelfGuardianAddress(
      currentUser.userId,
      addressId,
      dto,
    );
  }

  // @post-mvp: 角色切换在 V1 默认关闭。
  @UseGuards(JwtAuthGuard)
  @Post('role/switch')
  @RequireCapability('roleSwitch')
  @ApiExcludeEndpoint()
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '切换当前活跃身份' })
  @ApiOkResponse({ type: AuthResponseDto })
  async switchRole(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Body() dto: RoleSwitchDto,
  ) {
    return this.authService.switchRole(currentUser.userId, dto.role);
  }

  // @post-mvp: 绑定手机号在 V1 默认关闭。
  @UseGuards(JwtAuthGuard)
  @Post('bind/phone/request')
  @RequireCapability('bindPhone')
  @ApiExcludeEndpoint()
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '请求绑定手机号验证码' })
  @ApiOkResponse({ type: AuthCodeDispatchResponseDto })
  async requestBindPhoneCode(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Body() dto: BindPhoneRequestDto,
  ) {
    return this.authService.requestPhoneBindCode(currentUser.userId, dto.phone);
  }

  // @post-mvp: 绑定手机号在 V1 默认关闭。
  @UseGuards(JwtAuthGuard)
  @Post('bind/phone/confirm')
  @RequireCapability('bindPhone')
  @ApiExcludeEndpoint()
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

  // @post-mvp: 绑定邮箱密码在 V1 默认关闭。
  @UseGuards(JwtAuthGuard)
  @Post('bind/email-password')
  @RequireCapability('bindEmailPassword')
  @ApiExcludeEndpoint()
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

  // @post-mvp: 密码重置在 V1 默认关闭。
  @UseGuards(JwtAuthGuard)
  @Post('password/reset/request')
  @RequireCapability('passwordReset')
  @ApiExcludeEndpoint()
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '向当前账号手机号发送设置/修改密码验证码' })
  @ApiOkResponse({ type: AuthCodeDispatchResponseDto })
  async requestPasswordResetCode(
    @CurrentUser() currentUser: AuthenticatedUserContext,
  ) {
    return this.authService.requestPasswordResetCode(currentUser.userId);
  }

  // @post-mvp: 密码重置在 V1 默认关闭。
  @UseGuards(JwtAuthGuard)
  @Post('password/reset/confirm')
  @RequireCapability('passwordReset')
  @ApiExcludeEndpoint()
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '使用短信验证码设置/修改密码' })
  @ApiOkResponse({ type: AuthResponseDto })
  async confirmPasswordReset(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Body() dto: ResetPasswordWithSmsDto,
  ) {
    return this.authService.confirmPasswordReset(
      currentUser.userId,
      dto.code,
      dto.password,
      currentUser.activeRole,
    );
  }

  // @post-mvp: 实名认证在 V1 默认关闭。
  @UseGuards(JwtAuthGuard)
  @Post('real-name/session')
  @RequireCapability('realNameVerification')
  @ApiExcludeEndpoint()
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '创建实名核身会话' })
  @ApiOkResponse({ type: RealNameVerificationSessionDto })
  async createRealNameVerificationSession(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Body() dto: RealNameVerificationSessionRequestDto,
  ) {
    return this.authService.createRealNameVerificationSession(
      currentUser.userId,
      dto,
    );
  }

  // @post-mvp: 实名认证在 V1 默认关闭。
  @UseGuards(JwtAuthGuard)
  @Post('real-name/mock/complete')
  @RequireCapability('realNameVerification')
  @ApiExcludeEndpoint()
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '开发环境下完成模拟实名核身' })
  @ApiOkResponse({ type: AuthResponseDto })
  async completeMockRealNameVerification(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Body() dto: CompleteMockRealNameVerificationDto,
  ) {
    return this.authService.completeMockRealNameVerification(
      currentUser.userId,
      dto,
      currentUser.activeRole,
    );
  }

  // @post-mvp: 老师资料单独编辑页保留实现，但 V1 默认关闭。
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireCapability('teacherProfileManage')
  @RequireRoles(PlatformRole.TEACHER)
  @Patch('self/teacher-profile')
  @ApiExcludeEndpoint()
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
  @RequireCapability('teacherOnboarding')
  @RequireRoles(PlatformRole.TEACHER)
  @Patch('self/teacher-onboarding')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '老师首登 onboarding 提交' })
  @ApiOkResponse({ type: AuthResponseDto })
  async updateTeacherOnboarding(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Body() dto: SelfTeacherOnboardingUpdateDto,
  ) {
    return this.authService.updateSelfTeacherOnboarding(currentUser.userId, dto);
  }

  // @post-mvp: 家长资料单独编辑页保留实现，但 V1 默认关闭。
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireCapability('guardianProfileManage')
  @RequireRoles(PlatformRole.GUARDIAN)
  @Patch('self/guardian-profile')
  @ApiExcludeEndpoint()
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
  @RequireCapability('guardianOnboarding')
  @RequireRoles(PlatformRole.GUARDIAN)
  @Patch('self/guardian-onboarding')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '家长首登 onboarding 提交' })
  @ApiOkResponse({ type: AuthResponseDto })
  async updateGuardianOnboarding(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Body() dto: SelfGuardianOnboardingUpdateDto,
  ) {
    return this.authService.updateSelfGuardianOnboarding(
      currentUser.userId,
      dto,
    );
  }

  // @post-mvp: 学生独立角色在 V1 默认关闭。
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireCapability('studentRole')
  @RequireRoles(PlatformRole.STUDENT)
  @Patch('self/student-profile')
  @ApiExcludeEndpoint()
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '学生自助更新个人档案' })
  @ApiOkResponse({ type: AuthResponseDto })
  async updateStudentProfile(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Body() dto: SelfStudentProfileUpdateDto,
  ) {
    return this.authService.updateSelfStudentProfile(currentUser.userId, dto);
  }

  // @post-mvp: 学生独立角色在 V1 默认关闭。
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireCapability('studentRole')
  @RequireRoles(PlatformRole.STUDENT)
  @Patch('self/student-onboarding')
  @ApiExcludeEndpoint()
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '学生首登 onboarding 提交' })
  @ApiOkResponse({ type: AuthResponseDto })
  async updateStudentOnboarding(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Body() dto: SelfStudentOnboardingUpdateDto,
  ) {
    return this.authService.updateSelfStudentOnboarding(currentUser.userId, dto);
  }
}
