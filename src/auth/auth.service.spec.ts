import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import type { AdminUserRow } from '../database/schema';
import { FakeAuthRepository } from '../../test/support/fake-repositories';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let repository: FakeAuthRepository;
  let service: AuthService;

  beforeAll(async () => {
    repository = new FakeAuthRepository();
    repository.users.push(await adminUser());
    service = new AuthService(
      repository,
      new JwtService(),
      new ConfigService({
        JWT_ACCESS_SECRET: 'unit-access-secret-with-at-least-32-chars',
        JWT_REFRESH_SECRET: 'unit-refresh-secret-with-at-least-32-chars',
        JWT_ACCESS_TTL_SECONDS: 900,
        JWT_REFRESH_TTL_SECONDS: 604800,
      }),
    );
  });

  it('authenticates with a hash and never returns the password hash', async () => {
    const result = await service.login(
      'admin@example.test',
      'Test-password-42',
    );
    expect(result.user.email).toBe('admin@example.test');
    expect(result).not.toHaveProperty('passwordHash');
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
  });

  it('rotates a valid refresh token', async () => {
    const login = await service.login('admin@example.test', 'Test-password-42');
    const refreshed = await service.refresh(login.refreshToken);
    expect(refreshed.refreshToken).not.toBe(login.refreshToken);
    await expect(service.refresh(login.refreshToken)).rejects.toThrow(
      'Invalid session',
    );
  });

  it('rejects invalid credentials without disclosing the account state', async () => {
    await expect(
      service.login('admin@example.test', 'wrong-password'),
    ).rejects.toThrow('Invalid credentials');
    await expect(
      service.login('missing@example.test', 'wrong-password'),
    ).rejects.toThrow('Invalid credentials');
  });
});

async function adminUser(): Promise<AdminUserRow> {
  const now = new Date();
  return {
    id: randomUUID(),
    email: 'admin@example.test',
    passwordHash: await AuthService.hashPassword('Test-password-42'),
    firstName: 'Test',
    lastName: 'Admin',
    phone: null,
    avatarUrl: null,
    notificationPreferences: {
      newOrder: true,
      toConfirm: true,
      lowStock: true,
      reviews: false,
      emailDigest: true,
    },
    role: 'super_admin',
    status: 'active',
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
  };
}
