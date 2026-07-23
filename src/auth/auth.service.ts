import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from 'argon2';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { AUTH_REPOSITORY } from './auth.constants';
import type { AuthRepository } from './auth.repository';
import type {
  AccessTokenPayload,
  AuthenticatedAdmin,
  RefreshTokenPayload,
} from './auth.types';
import { ROLE_PERMISSIONS } from './permissions';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
}

export interface AuthResult extends AuthTokens {
  user: AuthenticatedAdmin;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_REPOSITORY)
    private readonly repository: AuthRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.repository.findUserByEmail(email.trim());
    if (
      !user ||
      user.status !== 'active' ||
      !(await verify(user.passwordHash, password))
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const now = new Date();
    const sessionId = randomUUID();
    const tokens = await this.issueTokens(user.id, sessionId);
    await this.repository.createSession({
      id: sessionId,
      adminUserId: user.id,
      tokenHash: this.tokenHash(tokens.refreshToken),
      expiresAt: new Date(now.getTime() + tokens.refreshTtlSeconds * 1000),
    });
    await this.repository.touchLastLogin(user.id, now);

    return {
      ...tokens,
      user: { ...this.toAdmin(user), lastLoginAt: now },
    };
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const [session, user] = await Promise.all([
      this.repository.findSession(payload.sid),
      this.repository.findUserById(payload.sub),
    ]);
    const currentHash = this.tokenHash(refreshToken);
    if (
      !session ||
      !user ||
      user.status !== 'active' ||
      session.adminUserId !== user.id ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !this.hashesMatch(session.tokenHash, currentHash)
    ) {
      throw new UnauthorizedException('Invalid session');
    }

    const tokens = await this.issueTokens(user.id, session.id);
    await this.repository.rotateSession(
      session.id,
      this.tokenHash(tokens.refreshToken),
      new Date(),
    );
    return { ...tokens, user: this.toAdmin(user) };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) {
      return;
    }
    try {
      const payload = await this.verifyRefreshToken(refreshToken);
      await this.repository.revokeSession(payload.sid, new Date());
    } catch {
      // Cookies are cleared even when the token is expired or malformed.
    }
  }

  async authenticate(accessToken: string): Promise<AuthenticatedAdmin> {
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(accessToken, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid access token');
    }
    const user = await this.repository.findUserById(payload.sub);
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Inactive admin user');
    }
    return this.toAdmin(user);
  }

  permissionsFor(user: AuthenticatedAdmin) {
    return ROLE_PERMISSIONS[user.role];
  }

  static hashPassword(password: string): Promise<string> {
    return hash(password, {
      type: 2,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });
  }

  private async issueTokens(
    userId: string,
    sessionId: string,
  ): Promise<AuthTokens> {
    const accessTtlSeconds = this.config.getOrThrow<number>(
      'JWT_ACCESS_TTL_SECONDS',
    );
    const refreshTtlSeconds = this.config.getOrThrow<number>(
      'JWT_REFRESH_TTL_SECONDS',
    );
    const accessPayload: AccessTokenPayload = {
      sub: userId,
      jti: randomUUID(),
      type: 'access',
    };
    const refreshPayload: RefreshTokenPayload = {
      sub: userId,
      sid: sessionId,
      jti: randomUUID(),
      type: 'refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessTtlSeconds,
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshTtlSeconds,
      }),
    ]);
    return {
      accessToken,
      refreshToken,
      accessTtlSeconds,
      refreshTtlSeconds,
    };
  }

  private async verifyRefreshToken(
    token: string,
  ): Promise<RefreshTokenPayload> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      if (payload.type !== 'refresh' || !payload.sid) {
        throw new Error('Wrong token type');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private tokenHash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private hashesMatch(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'hex');
    const rightBuffer = Buffer.from(right, 'hex');
    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }

  private toAdmin(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    avatarUrl: string | null;
    role: AuthenticatedAdmin['role'];
    status: AuthenticatedAdmin['status'];
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): AuthenticatedAdmin {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`.trim(),
      phone: user.phone ?? undefined,
      avatarUrl: user.avatarUrl ?? undefined,
      role: user.role,
      status: user.status,
      lastLoginAt: user.lastLoginAt ?? undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
