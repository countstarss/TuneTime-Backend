import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from './supabase-auth.guard';
import { AuthService } from './auth.service';

type RegisterBody = {
  name?: string;
  email?: string;
  password?: string;
};

type LoginBody = {
  email?: string;
  password?: string;
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterBody) {
    const name = typeof body.name === 'string' ? body.name.trim() : undefined;
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Please provide a valid email');
    }

    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    if (name && name.length > 64) {
      throw new BadRequestException('Name is too long');
    }

    return this.authService.registerWithPassword({ name, email, password });
  }

  @Post('login')
  async login(@Body() body: LoginBody) {
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    return this.authService.loginWithPassword({ email, password });
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Req() req: { user?: { sub?: string } }) {
    const userId = req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const profile = await this.authService.getProfileByUserId(userId);
    if (!profile) {
      throw new UnauthorizedException('User not found');
    }

    return profile;
  }
}
