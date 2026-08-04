import { randomUUID } from 'node:crypto';
import type { AuthenticatedRequest } from '../auth/auth.types';
import type { AdminInvitationRow, AdminUserRow } from '../database/schema';
import type { EmailService } from '../email/email.service';
import type { TeamRepository } from './team.repository';
import { TeamService } from './team.service';

describe('TeamService', () => {
  it('creates a pending invitation and sends the raw token only to email', async () => {
    const invitation = invitationRow();
    let sentToken = '';
    const createInvitation = jest.fn().mockResolvedValue(invitation);
    const repository = {
      findUserByEmail: jest.fn().mockResolvedValue(null),
      findPendingInvitationByEmail: jest.fn().mockResolvedValue(null),
      createInvitation,
    } as unknown as TeamRepository;
    const email = {
      sendTeamInvitation: jest
        .fn()
        .mockImplementation((input: { token: string }) => {
          sentToken = input.token;
        }),
    } as unknown as EmailService;
    const service = new TeamService(repository, email);

    const result = await service.invite(
      {
        firstName: 'Amina',
        lastName: 'Test',
        email: 'Amina@example.test',
        role: 'operateur',
      },
      { admin: { id: randomUUID() } } as AuthenticatedRequest,
    );

    expect(result.member.status).toBe('pending');
    expect(result.member).not.toHaveProperty('token');
    expect(sentToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'amina@example.test',
        role: 'operateur',
      }),
    );
  });

  it('rejects a self role/status change', async () => {
    const user = userRow();
    const repository = {
      findUserById: jest.fn().mockResolvedValue(user),
    } as unknown as TeamRepository;
    const service = new TeamService(repository, {} as EmailService);

    await expect(
      service.updateMember(user.id, { status: 'disabled' }, {
        admin: { id: user.id },
      } as AuthenticatedRequest),
    ).rejects.toThrow('You cannot change your own role or status');
  });
});

function invitationRow(): AdminInvitationRow {
  const now = new Date();
  return {
    id: randomUUID(),
    email: 'amina@example.test',
    firstName: 'Amina',
    lastName: 'Test',
    phone: null,
    role: 'operateur',
    tokenHash: 'a'.repeat(64),
    expiresAt: new Date(now.getTime() + 86_400_000),
    acceptedAt: null,
    revokedAt: null,
    createdBy: null,
    createdAt: now,
    updatedAt: now,
  };
}

function userRow(): AdminUserRow {
  const now = new Date();
  return {
    id: randomUUID(),
    email: 'admin@example.test',
    passwordHash: 'hash',
    firstName: 'Admin',
    lastName: 'Test',
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
