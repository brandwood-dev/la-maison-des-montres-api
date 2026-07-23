import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants';
import type { AppDatabase } from '../database/database.types';
import {
  adminSessions,
  adminUsers,
  type AdminSessionRow,
  type AdminUserRow,
} from '../database/schema';

export interface AuthRepository {
  findUserByEmail(email: string): Promise<AdminUserRow | null>;
  findUserById(id: string): Promise<AdminUserRow | null>;
  touchLastLogin(id: string, at: Date): Promise<void>;
  createSession(input: {
    id: string;
    adminUserId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  findSession(id: string): Promise<AdminSessionRow | null>;
  rotateSession(id: string, tokenHash: string, at: Date): Promise<void>;
  revokeSession(id: string, at: Date): Promise<void>;
}

@Injectable()
export class DrizzleAuthRepository implements AuthRepository {
  constructor(
    @Inject(DATABASE) private readonly database: AppDatabase | null,
  ) {}

  async findUserByEmail(email: string): Promise<AdminUserRow | null> {
    const database = this.getDatabase();
    const rows = await database
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

  async touchLastLogin(id: string, at: Date): Promise<void> {
    await this.getDatabase()
      .update(adminUsers)
      .set({ lastLoginAt: at, updatedAt: at })
      .where(eq(adminUsers.id, id));
  }

  async createSession(input: {
    id: string;
    adminUserId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.getDatabase().insert(adminSessions).values(input);
  }

  async findSession(id: string): Promise<AdminSessionRow | null> {
    const rows = await this.getDatabase()
      .select()
      .from(adminSessions)
      .where(eq(adminSessions.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async rotateSession(id: string, tokenHash: string, at: Date): Promise<void> {
    await this.getDatabase()
      .update(adminSessions)
      .set({ tokenHash, lastUsedAt: at })
      .where(eq(adminSessions.id, id));
  }

  async revokeSession(id: string, at: Date): Promise<void> {
    await this.getDatabase()
      .update(adminSessions)
      .set({ revokedAt: at })
      .where(eq(adminSessions.id, id));
  }

  private getDatabase(): AppDatabase {
    if (!this.database) {
      throw new ServiceUnavailableException('Database is not configured');
    }
    return this.database;
  }
}
