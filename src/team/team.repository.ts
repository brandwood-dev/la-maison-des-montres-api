import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants';
import type { AppDatabase } from '../database/database.types';
import {
  adminInvitations,
  adminUsers,
  type AdminInvitationRow,
  type AdminUserRow,
} from '../database/schema';
import { TEAM_REPOSITORY } from './team.constants';

export interface TeamRepository {
  listUsers(): Promise<AdminUserRow[]>;
  listActiveUsersForOrderNotifications(): Promise<
    Array<Pick<AdminUserRow, 'email' | 'role' | 'notificationPreferences'>>
  >;
  listPendingInvitations(): Promise<AdminInvitationRow[]>;
  findUserByEmail(email: string): Promise<AdminUserRow | null>;
  findUserById(id: string): Promise<AdminUserRow | null>;
  findPendingInvitationByEmail(
    email: string,
  ): Promise<AdminInvitationRow | null>;
  createInvitation(
    input: typeof adminInvitations.$inferInsert,
  ): Promise<AdminInvitationRow>;
  updateInvitation(
    id: string,
    input: Partial<
      Pick<
        AdminInvitationRow,
        'tokenHash' | 'expiresAt' | 'updatedAt' | 'revokedAt'
      >
    >,
  ): Promise<AdminInvitationRow | null>;
  updateUser(
    id: string,
    input: Partial<Pick<AdminUserRow, 'role' | 'status'>>,
  ): Promise<AdminUserRow | null>;
  deleteUser(id: string): Promise<AdminUserRow | null>;
  countActiveSuperAdmins(): Promise<number>;
  acceptInvitation(input: {
    tokenHash: string;
    passwordHash: string;
  }): Promise<AdminUserRow>;
}

@Injectable()
export class DrizzleTeamRepository implements TeamRepository {
  constructor(
    @Inject(DATABASE) private readonly database: AppDatabase | null,
  ) {}

  async listUsers(): Promise<AdminUserRow[]> {
    return this.getDatabase()
      .select()
      .from(adminUsers)
      .orderBy(desc(adminUsers.createdAt));
  }

  async listActiveUsersForOrderNotifications(): Promise<
    Array<Pick<AdminUserRow, 'email' | 'role' | 'notificationPreferences'>>
  > {
    return this.getDatabase()
      .select({
        email: adminUsers.email,
        role: adminUsers.role,
        notificationPreferences: adminUsers.notificationPreferences,
      })
      .from(adminUsers)
      .where(eq(adminUsers.status, 'active'));
  }

  async listPendingInvitations(): Promise<AdminInvitationRow[]> {
    return this.getDatabase()
      .select()
      .from(adminInvitations)
      .where(
        and(
          isNull(adminInvitations.acceptedAt),
          isNull(adminInvitations.revokedAt),
        ),
      )
      .orderBy(desc(adminInvitations.createdAt));
  }

  async findUserByEmail(email: string): Promise<AdminUserRow | null> {
    const rows = await this.getDatabase()
      .select()
      .from(adminUsers)
      .where(sql`lower(${adminUsers.email}) = ${email.toLowerCase()}`)
      .limit(1);
    return rows[0] ?? null;
  }

  async findUserById(id: string): Promise<AdminUserRow | null> {
    const rows = await this.getDatabase()
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async findPendingInvitationByEmail(
    email: string,
  ): Promise<AdminInvitationRow | null> {
    const rows = await this.getDatabase()
      .select()
      .from(adminInvitations)
      .where(
        and(
          sql`lower(${adminInvitations.email}) = ${email.toLowerCase()}`,
          isNull(adminInvitations.acceptedAt),
          isNull(adminInvitations.revokedAt),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async createInvitation(
    input: typeof adminInvitations.$inferInsert,
  ): Promise<AdminInvitationRow> {
    const [row] = await this.getDatabase()
      .insert(adminInvitations)
      .values(input)
      .returning();
    return row;
  }

  async updateInvitation(
    id: string,
    input: Partial<
      Pick<
        AdminInvitationRow,
        'tokenHash' | 'expiresAt' | 'updatedAt' | 'revokedAt'
      >
    >,
  ): Promise<AdminInvitationRow | null> {
    const [row] = await this.getDatabase()
      .update(adminInvitations)
      .set(input)
      .where(eq(adminInvitations.id, id))
      .returning();
    return row ?? null;
  }

  async updateUser(
    id: string,
    input: Partial<Pick<AdminUserRow, 'role' | 'status'>>,
  ): Promise<AdminUserRow | null> {
    const [row] = await this.getDatabase()
      .update(adminUsers)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(adminUsers.id, id))
      .returning();
    return row ?? null;
  }

  async deleteUser(id: string): Promise<AdminUserRow | null> {
    const [row] = await this.getDatabase()
      .delete(adminUsers)
      .where(eq(adminUsers.id, id))
      .returning();
    return row ?? null;
  }

  async countActiveSuperAdmins(): Promise<number> {
    const rows = await this.getDatabase()
      .select({ count: sql<number>`count(*)::int` })
      .from(adminUsers)
      .where(
        and(
          eq(adminUsers.role, 'super_admin'),
          eq(adminUsers.status, 'active'),
        ),
      );
    return rows[0]?.count ?? 0;
  }

  async acceptInvitation(input: {
    tokenHash: string;
    passwordHash: string;
  }): Promise<AdminUserRow> {
    const database = this.getDatabase();
    return database.transaction(async (transaction) => {
      const now = new Date();
      const [invitation] = await transaction
        .select()
        .from(adminInvitations)
        .where(
          and(
            eq(adminInvitations.tokenHash, input.tokenHash),
            isNull(adminInvitations.acceptedAt),
            isNull(adminInvitations.revokedAt),
            gt(adminInvitations.expiresAt, now),
          ),
        )
        .limit(1);
      if (!invitation) throw new Error('INVITATION_INVALID');

      const [claimed] = await transaction
        .update(adminInvitations)
        .set({ acceptedAt: now, updatedAt: now })
        .where(
          and(
            eq(adminInvitations.id, invitation.id),
            isNull(adminInvitations.acceptedAt),
            isNull(adminInvitations.revokedAt),
          ),
        )
        .returning();
      if (!claimed) throw new Error('INVITATION_INVALID');

      const [user] = await transaction
        .insert(adminUsers)
        .values({
          email: invitation.email.toLowerCase(),
          passwordHash: input.passwordHash,
          firstName: invitation.firstName,
          lastName: invitation.lastName,
          phone: invitation.phone,
          role: invitation.role,
          status: 'active',
        })
        .returning();
      return user;
    });
  }

  private getDatabase(): AppDatabase {
    if (!this.database)
      throw new ServiceUnavailableException('Database is not configured');
    return this.database;
  }
}

export const teamRepositoryProvider = {
  provide: TEAM_REPOSITORY,
  useExisting: DrizzleTeamRepository,
};
