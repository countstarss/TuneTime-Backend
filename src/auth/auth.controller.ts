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
} from './dto/auth.dto';
import { StudentResponseDto } from '../students/dto/student-response.dto';
import { AddressResponseDto } from '../addresses/dto/address-response.dto';
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

  @Post('phone-password/login')
  @ApiOperation({ summary: '手机号密码登录' })
  @ApiOkResponse({ type: AuthResponseDto })
  async loginWithPhonePassword(@Body() dto: PhonePasswordLoginDto) {
    return this.authService.loginWithPhonePassword(dto);
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
  @Get('self/booking-context')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '获取当前账号的约课上下文' })
  @ApiOkResponse({ type: SelfBookingContextDto })
  async getSelfBookingContext(
    @CurrentUser() currentUser: AuthenticatedUserContext,
  ) {
    return this.authService.getSelfBookingContext(currentUser.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRoles(PlatformRole.GUARDIAN)
  @Get('self/guardian/students')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '获取当前家长名下的孩子资料列表' })
  @ApiOkResponse({ type: StudentResponseDto, isArray: true })
  async listSelfGuardianStudents(
    @CurrentUser() currentUser: AuthenticatedUserContext,
  ) {
    return this.authService.listSelfGuardianStudents(currentUser.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRoles(PlatformRole.GUARDIAN)
  @Post('self/guardian/students')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '为当前家长新增孩子资料' })
  @ApiOkResponse({ type: StudentResponseDto })
  async createSelfGuardianStudent(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Body() dto: SelfGuardianStudentCreateDto,
  ) {
    return this.authService.createSelfGuardianStudent(currentUser.userId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRoles(PlatformRole.GUARDIAN)
  @Patch('self/guardian/students/:studentId')
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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRoles(PlatformRole.GUARDIAN)
  @Get('self/guardian/addresses')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '获取当前家长的地址列表' })
  @ApiOkResponse({ type: AddressResponseDto, isArray: true })
  async listSelfGuardianAddresses(
    @CurrentUser() currentUser: AuthenticatedUserContext,
  ) {
    return this.authService.listSelfGuardianAddresses(currentUser.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRoles(PlatformRole.GUARDIAN)
  @Post('self/guardian/addresses')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '为当前家长新增上课地址' })
  @ApiOkResponse({ type: AddressResponseDto })
  async createSelfGuardianAddress(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Body() dto: SelfGuardianAddressCreateDto,
  ) {
    return this.authService.createSelfGuardianAddress(currentUser.userId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRoles(PlatformRole.GUARDIAN)
  @Patch('self/guardian/addresses/:addressId')
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

  @UseGuards(JwtAuthGuard)
  @Post('password/reset/request')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '向当前账号手机号发送设置/修改密码验证码' })
  @ApiOkResponse({ type: AuthCodeDispatchResponseDto })
  async requestPasswordResetCode(
    @CurrentUser() currentUser: AuthenticatedUserContext,
  ) {
    return this.authService.requestPasswordResetCode(currentUser.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('password/reset/confirm')
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

  @UseGuards(JwtAuthGuard)
  @Post('real-name/session')
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

  @UseGuards(JwtAuthGuard)
  @Post('real-name/mock/complete')
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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRoles(PlatformRole.STUDENT)
  @Patch('self/student-onboarding')
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
