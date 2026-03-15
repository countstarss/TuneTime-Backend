import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './supabase-auth.guard';

@Controller('auth')
export class AuthController {
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Req() req) {
    return req.user;
  }
}
