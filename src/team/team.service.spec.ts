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

  it('revokes a pending invitation and invalidates its access entry', async () => {
    const invitation = invitationRow();
    const updateInvitation = jest.fn().mockResolvedValue({
      ...invitation,
      revokedAt: new Date(),
    });
    const repository = {
      listPendingInvitations: jest.fn().mockResolvedValue([invitation]),
      updateInvitation,
    } as unknown as TeamRepository;
    const setEmailAccess = jest
      .fn<Promise<void>, [string, boolean]>()
      .mockResolvedValue(undefined);
    const access = { setEmailAccess };
    const service = new TeamService(
      repository,
      {} as EmailService,
      access as never,
    );

    await service.revoke(invitation.id);

    expect(updateInvitation).toHaveBeenCalledWith(
      invitation.id,
      expect.any(Object),
    );
    expect(setEmailAccess).toHaveBeenCalledWith(invitation.email, false);
  });

  it('deletes another member but protects the current account', async () => {
    const user = userRow();
    const deleteUser = jest.fn().mockResolvedValue(user);
    const repository = {
      findUserById: jest.fn().mockResolvedValue(user),
      deleteUser,
      countActiveSuperAdmins: jest.fn().mockResolvedValue(2),
    } as unknown as TeamRepository;
    const service = new TeamService(repository, {} as EmailService);

    const result = await service.removeMember(user.id, {
      admin: { id: randomUUID() },
    } as AuthenticatedRequest);
    expect(result.deleted).toBe(true);
    expect(deleteUser).toHaveBeenCalledWith(user.id);

    await expect(
      service.removeMember(user.id, {
        admin: { id: user.id },
      } as AuthenticatedRequest),
    ).rejects.toThrow('You cannot delete your own account');
  });

  it('protects the last active super administrator from deletion', async () => {
    const user = userRow();
    const repository = {
      findUserById: jest.fn().mockResolvedValue(user),
      countActiveSuperAdmins: jest.fn().mockResolvedValue(1),
    } as unknown as TeamRepository;
    const service = new TeamService(repository, {} as EmailService);

    await expect(
      service.removeMember(user.id, {
        admin: { id: randomUUID() },
      } as AuthenticatedRequest),
    ).rejects.toThrow('At least one active super administrator is required');
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
