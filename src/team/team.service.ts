import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { AuthService } from '../auth/auth.service';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { EmailService } from '../email/email.service';
import type { AdminUserRow } from '../database/schema';
import { TEAM_REPOSITORY } from './team.constants';
import type { TeamRepository } from './team.repository';
import type {
  CreateTeamInvitationDto,
  UpdateTeamMemberDto,
} from './dto/team.dto';

const INVITATION_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class TeamService {
  constructor(
    @Inject(TEAM_REPOSITORY) private readonly repository: TeamRepository,
    private readonly email: EmailService,
  ) {}

  async list() {
    const [users, invitations] = await Promise.all([
      this.repository.listUsers(),
      this.repository.listPendingInvitations(),
    ]);
    return {
      data: [
        ...users.map((user) => this.userResponse(user)),
        ...invitations.map((invitation) => this.invitationResponse(invitation)),
      ],
      total: users.length + invitations.length,
    };
  }

  async invite(input: CreateTeamInvitationDto, request: AuthenticatedRequest) {
    const email = input.email.trim().toLowerCase();
    if (await this.repository.findUserByEmail(email)) {
      throw new ConflictException('A team member already uses this email');
    }
    if (await this.repository.findPendingInvitationByEmail(email)) {
      throw new ConflictException(
        'An invitation is already pending for this email',
      );
    }

    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    const invitation = await this.repository.createInvitation({
      email,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      phone: input.phone?.trim() || null,
      role: input.role,
      tokenHash: this.tokenHash(token),
      expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
      createdBy: request.admin?.id,
      createdAt: now,
      updatedAt: now,
    });

    try {
      await this.email.sendTeamInvitation({
        email: invitation.email,
        firstName: invitation.firstName,
        role: invitation.role,
        token,
        message: input.message,
      });
    } catch {
      // Keep the invitation pending so the super-admin can resend it without
      // creating duplicate records. The token is never returned to the client.
      throw new ServiceUnavailableException(
        'Invitation email could not be sent',
      );
    }
    return { member: this.invitationResponse(invitation), emailSent: true };
  }

  async resend(id: string) {
    const invitation = (await this.repository.listPendingInvitations()).find(
      (item) => item.id === id,
    );
    if (!invitation) throw new NotFoundException('Invitation not found');

    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    const updated = await this.repository.updateInvitation(id, {
      tokenHash: this.tokenHash(token),
      expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
      updatedAt: now,
    });
    if (!updated) throw new NotFoundException('Invitation not found');
    try {
      await this.email.sendTeamInvitation({
        email: updated.email,
        firstName: updated.firstName,
        role: updated.role,
        token,
      });
    } catch {
      throw new ServiceUnavailableException(
        'Invitation email could not be sent',
      );
    }
    return { member: this.invitationResponse(updated), emailSent: true };
  }

  async revoke(id: string): Promise<void> {
    const updated = await this.repository.updateInvitation(id, {
      revokedAt: new Date(),
      updatedAt: new Date(),
    });
    if (!updated) throw new NotFoundException('Invitation not found');
  }

  async updateMember(
    id: string,
    input: UpdateTeamMemberDto,
    request: AuthenticatedRequest,
  ) {
    const user = await this.repository.findUserById(id);
    if (!user) throw new NotFoundException('Team member not found');
    if (
      request.admin?.id === id &&
      (input.role !== undefined || input.status !== undefined)
    ) {
      throw new BadRequestException(
        'You cannot change your own role or status',
      );
    }
    if (
      user.role === 'super_admin' &&
      user.status === 'active' &&
      ((input.role !== undefined && input.role !== 'super_admin') ||
        (input.status !== undefined && input.status !== 'active')) &&
      (await this.repository.countActiveSuperAdmins()) <= 1
    ) {
      throw new ConflictException(
        'At least one active super administrator is required',
      );
    }
    const updated = await this.repository.updateUser(id, {
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    });
    if (!updated) throw new NotFoundException('Team member not found');
    return { member: this.userResponse(updated) };
  }

  async accept(token: string, password: string) {
    if (!/^[A-Za-z0-9_-]{40,}$/.test(token)) {
      throw new BadRequestException('Invalid invitation token');
    }
    try {
      const user = await this.repository.acceptInvitation({
        tokenHash: this.tokenHash(token),
        passwordHash: await AuthService.hashPassword(password),
      });
      return { email: user.email };
    } catch (error) {
      if (error instanceof Error && error.message === 'INVITATION_INVALID') {
        throw new BadRequestException('Invitation is invalid or expired');
      }
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('A team member already uses this email');
      }
      throw error;
    }
  }

  private userResponse(user: AdminUserRow) {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      phone: user.phone ?? undefined,
      avatarUrl: user.avatarUrl ?? undefined,
      role: user.role,
      status: user.status,
      lastLoginAt: user.lastLoginAt?.toISOString(),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  private invitationResponse(invitation: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    role: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: invitation.id,
      firstName: invitation.firstName,
      lastName: invitation.lastName,
      fullName: `${invitation.firstName} ${invitation.lastName}`.trim(),
      email: invitation.email,
      phone: invitation.phone ?? undefined,
      role: invitation.role,
      status: 'pending' as const,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
      updatedAt: invitation.updatedAt.toISOString(),
    };
  }

  private tokenHash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private isUniqueViolation(error: unknown): boolean {
    return Boolean(
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === '23505',
    );
  }
}
