import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, asc, count, desc, eq, inArray } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants';
import type { AppDatabase } from '../database/database.types';
import {
  promoBannerMessages,
  type PromoBannerMessageRow,
} from '../database/schema';
import {
  CreatePromoBannerMessageDto,
  ListPromoBannerMessagesQueryDto,
  ReorderPromoBannerMessagesDto,
  UpdatePromoBannerMessageDto,
} from './promo-banner.dto';

export type PromoBannerMessageResponse = {
  id: string;
  message: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type PromoBannerMessagePage = {
  data: PromoBannerMessageResponse[];
  page: number;
  pageSize: number;
  total: number;
};

const MAX_ACTIVE_MESSAGES = 10;

@Injectable()
export class PromoBannerService {
  constructor(
    @Inject(DATABASE) private readonly database: AppDatabase | null,
  ) {}

  async list(
    input: ListPromoBannerMessagesQueryDto,
  ): Promise<PromoBannerMessagePage> {
    const database = this.getDatabase();
    const conditions =
      input.active === undefined
        ? []
        : [eq(promoBannerMessages.active, input.active)];
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, totals] = await Promise.all([
      database
        .select()
        .from(promoBannerMessages)
        .where(where)
        .orderBy(
          asc(promoBannerMessages.sortOrder),
          desc(promoBannerMessages.updatedAt),
        )
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize),
      database
        .select({ value: count() })
        .from(promoBannerMessages)
        .where(where),
    ]);
    return {
      data: rows.map((row) => this.response(row)),
      page: input.page,
      pageSize: input.pageSize,
      total: Number(totals[0]?.value ?? 0),
    };
  }

  async get(id: string): Promise<PromoBannerMessageResponse> {
    const row = await this.find(id);
    if (!row) throw new NotFoundException('Promo banner message not found');
    return this.response(row);
  }

  async create(
    input: CreatePromoBannerMessageDto,
  ): Promise<PromoBannerMessageResponse> {
    const normalized = this.normalize(input);
    const database = this.getDatabase();
    const active = input.active ?? true;
    await this.assertActiveCapacity(database, active, false);
    const [row] = await database
      .insert(promoBannerMessages)
      .values({
        message: this.required(normalized.message, 'message'),
        sortOrder: normalized.sortOrder ?? 1,
        active,
      })
      .returning();
    return this.response(row);
  }

  async update(
    id: string,
    input: UpdatePromoBannerMessageDto,
  ): Promise<PromoBannerMessageResponse> {
    const current = await this.find(id);
    if (!current) throw new NotFoundException('Promo banner message not found');
    const normalized = this.normalize(input);
    const database = this.getDatabase();
    const nextActive = input.active ?? current.active;
    await this.assertActiveCapacity(database, nextActive, current.active);
    const [row] = await database
      .update(promoBannerMessages)
      .set({ ...normalized, active: nextActive, updatedAt: new Date() })
      .where(eq(promoBannerMessages.id, id))
      .returning();
    return this.response(row);
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.getDatabase()
      .delete(promoBannerMessages)
      .where(eq(promoBannerMessages.id, id))
      .returning({ id: promoBannerMessages.id });
    if (!deleted.length)
      throw new NotFoundException('Promo banner message not found');
  }

  async reorder(
    input: ReorderPromoBannerMessagesDto,
  ): Promise<PromoBannerMessageResponse[]> {
    const database = this.getDatabase();
    const rows = await database
      .select()
      .from(promoBannerMessages)
      .where(inArray(promoBannerMessages.id, input.ids));
    if (rows.length !== input.ids.length) {
      throw new BadRequestException(
        'The reorder list must contain existing promo banner message ids',
      );
    }
    await database.transaction(async (tx) => {
      for (const [index, id] of input.ids.entries()) {
        await tx
          .update(promoBannerMessages)
          .set({ sortOrder: index + 1, updatedAt: new Date() })
          .where(eq(promoBannerMessages.id, id));
      }
    });
    return (await this.list({ page: 1, pageSize: 100 })).data;
  }

  async publicList(): Promise<PromoBannerMessagePage> {
    const rows = await this.getDatabase()
      .select()
      .from(promoBannerMessages)
      .where(eq(promoBannerMessages.active, true))
      .orderBy(
        asc(promoBannerMessages.sortOrder),
        desc(promoBannerMessages.updatedAt),
      )
      .limit(MAX_ACTIVE_MESSAGES);
    return {
      data: rows.map((row) => this.response(row)),
      page: 1,
      pageSize: MAX_ACTIVE_MESSAGES,
      total: rows.length,
    };
  }

  private async find(id: string): Promise<PromoBannerMessageRow | null> {
    const [row] = await this.getDatabase()
      .select()
      .from(promoBannerMessages)
      .where(eq(promoBannerMessages.id, id))
      .limit(1);
    return row ?? null;
  }

  private async assertActiveCapacity(
    database: AppDatabase,
    nextActive: boolean,
    currentActive: boolean,
  ): Promise<void> {
    if (!nextActive || currentActive) return;
    const [row] = await database
      .select({ value: count() })
      .from(promoBannerMessages)
      .where(eq(promoBannerMessages.active, true));
    if (Number(row?.value ?? 0) >= MAX_ACTIVE_MESSAGES) {
      throw new ConflictException(
        'A maximum of 10 active promo banner messages is allowed',
      );
    }
  }

  private normalize(
    input: CreatePromoBannerMessageDto | UpdatePromoBannerMessageDto,
  ) {
    const message = input.message?.trim();
    if (message === '') throw new BadRequestException('message is required');
    return {
      ...(message !== undefined ? { message } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    };
  }

  private required(value: string | undefined, field: string): string {
    if (!value) throw new BadRequestException(`${field} is required`);
    return value;
  }

  private response(row: PromoBannerMessageRow): PromoBannerMessageResponse {
    return {
      id: row.id,
      message: row.message,
      sortOrder: row.sortOrder,
      active: row.active,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private getDatabase(): AppDatabase {
    if (!this.database) {
      throw new ServiceUnavailableException('Database is not configured');
    }
    return this.database;
  }
}
