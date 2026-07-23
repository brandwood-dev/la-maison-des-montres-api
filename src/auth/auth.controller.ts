import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Response } from 'express';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './auth.constants';
import { Public } from './auth.decorators';
import { AuthService, type AuthResult } from './auth.service';
import type { AuthenticatedRequest } from './auth.types';
import { LoginDto } from './dto/login.dto';

@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() input: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(input.email, input.password);
    this.setCookies(response, result);
    return this.publicResult(result);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = request.cookies?.[REFRESH_COOKIE] as string | undefined;
    const result = await this.auth.refresh(token ?? '');
    this.setCookies(response, result);
    return this.publicResult(result);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const token = request.cookies?.[REFRESH_COOKIE] as string | undefined;
    await this.auth.logout(token);
    response.clearCookie(ACCESS_COOKIE, this.cookieOptions('/'));
    response.clearCookie(REFRESH_COOKIE, this.cookieOptions('/api/v1/auth'));
  }

  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    return {
      user: request.admin,
      permissions: request.permissions,
    };
  }

  private setCookies(response: Response, result: AuthResult): void {
    response.cookie(ACCESS_COOKIE, result.accessToken, {
      ...this.cookieOptions('/'),
      maxAge: result.accessTtlSeconds * 1000,
    });
    response.cookie(REFRESH_COOKIE, result.refreshToken, {
      ...this.cookieOptions('/api/v1/auth'),
      maxAge: result.refreshTtlSeconds * 1000,
    });
  }

  private cookieOptions(path: string): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.getOrThrow<boolean>('COOKIE_SECURE'),
      sameSite: 'strict',
      path,
    };
  }

  private publicResult(result: AuthResult) {
    return {
      user: result.user,
      permissions: this.auth.permissionsFor(result.user),
    };
  }
}
