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
import { heroSlides, type HeroSlideRow } from '../database/schema';
import {
  CreateHeroSlideDto,
  ListHeroSlidesQueryDto,
  ReorderHeroSlidesDto,
  UpdateHeroSlideDto,
} from './hero.dto';

export type HeroSlideResponse = {
  id: string;
  tagline?: string;
  title: string;
  subtitle?: string;
  ctaPrimaryLabel: string;
  ctaPrimaryHref: string;
  ctaSecondaryLabel: string;
  ctaSecondaryHref: string;
  imageUrl: string;
  imageKey?: string;
  imageAlt: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type HeroPage = {
  data: HeroSlideResponse[];
  page: number;
  pageSize: number;
  total: number;
};

const MAX_ACTIVE_SLIDES = 5;

@Injectable()
export class HeroService {
  constructor(
    @Inject(DATABASE) private readonly database: AppDatabase | null,
  ) {}

  async list(input: ListHeroSlidesQueryDto): Promise<HeroPage> {
    const database = this.getDatabase();
    const conditions =
      input.active === undefined ? [] : [eq(heroSlides.active, input.active)];
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, totals] = await Promise.all([
      database
        .select()
        .from(heroSlides)
        .where(where)
        .orderBy(asc(heroSlides.sortOrder), desc(heroSlides.updatedAt))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize),
      database.select({ value: count() }).from(heroSlides).where(where),
    ]);
    return {
      data: rows.map((row) => this.response(row)),
      page: input.page,
      pageSize: input.pageSize,
      total: Number(totals[0]?.value ?? 0),
    };
  }

  async get(id: string): Promise<HeroSlideResponse> {
    const row = await this.find(id);
    if (!row) throw new NotFoundException('Hero slide not found');
    return this.response(row);
  }

  async create(input: CreateHeroSlideDto): Promise<HeroSlideResponse> {
    const normalized = this.normalize(input);
    const database = this.getDatabase();
    const row = await database.transaction(async (tx) => {
      const activeCount = await this.activeCount(tx);
      const active = input.active ?? true;
      this.assertActiveTransition(active, activeCount, false);
      const [created] = await tx
        .insert(heroSlides)
        .values({
          ...normalized,
          title: this.required(normalized.title, 'title'),
          ctaPrimaryLabel: this.required(
            normalized.ctaPrimaryLabel,
            'ctaPrimaryLabel',
          ),
          ctaPrimaryHref: this.required(
            normalized.ctaPrimaryHref,
            'ctaPrimaryHref',
          ),
          ctaSecondaryLabel: this.required(
            normalized.ctaSecondaryLabel,
            'ctaSecondaryLabel',
          ),
          ctaSecondaryHref: this.required(
            normalized.ctaSecondaryHref,
            'ctaSecondaryHref',
          ),
          imageUrl: this.required(normalized.imageUrl, 'imageUrl'),
          active,
        })
        .returning();
      return created;
    });
    return this.response(row);
  }

  async update(
    id: string,
    input: UpdateHeroSlideDto,
  ): Promise<HeroSlideResponse> {
    const current = await this.find(id);
    if (!current) throw new NotFoundException('Hero slide not found');
    const patch = this.normalize(input);
    const database = this.getDatabase();
    const row = await database.transaction(async (tx) => {
      const activeCount = await this.activeCount(tx);
      const nextActive = input.active ?? current.active;
      this.assertActiveTransition(nextActive, activeCount, current.active);
      const [updated] = await tx
        .update(heroSlides)
        .set({ ...patch, active: nextActive, updatedAt: new Date() })
        .where(eq(heroSlides.id, id))
        .returning();
      return updated;
    });
    return this.response(row);
  }

  async remove(id: string): Promise<void> {
    const current = await this.find(id);
    if (!current) throw new NotFoundException('Hero slide not found');
    const database = this.getDatabase();
    await database.transaction(async (tx) => {
      const activeCount = await this.activeCount(tx);
      if (current.active && activeCount <= 1) {
        throw new ConflictException(
          'At least one published hero slide is required',
        );
      }
      const deleted = await tx
        .delete(heroSlides)
        .where(eq(heroSlides.id, id))
        .returning({ id: heroSlides.id });
      if (!deleted.length) throw new NotFoundException('Hero slide not found');
    });
  }

  async reorder(input: ReorderHeroSlidesDto): Promise<HeroSlideResponse[]> {
    const database = this.getDatabase();
    const rows = await database
      .select()
      .from(heroSlides)
      .where(inArray(heroSlides.id, input.ids));
    if (rows.length !== input.ids.length) {
      throw new BadRequestException(
        'The reorder list must contain existing slide ids',
      );
    }
    await database.transaction(async (tx) => {
      for (const [index, id] of input.ids.entries()) {
        await tx
          .update(heroSlides)
          .set({ sortOrder: index + 1, updatedAt: new Date() })
          .where(eq(heroSlides.id, id));
      }
    });
    return (await this.list({ page: 1, pageSize: 100 })).data;
  }

  async publicList(): Promise<HeroPage> {
    const database = this.getDatabase();
    const rows = await database
      .select()
      .from(heroSlides)
      .where(eq(heroSlides.active, true))
      .orderBy(asc(heroSlides.sortOrder), desc(heroSlides.updatedAt))
      .limit(MAX_ACTIVE_SLIDES);
    return {
      data: rows.map((row) => this.response(row)),
      page: 1,
      pageSize: MAX_ACTIVE_SLIDES,
      total: rows.length,
    };
  }

  private async find(id: string): Promise<HeroSlideRow | null> {
    const [row] = await this.getDatabase()
      .select()
      .from(heroSlides)
      .where(eq(heroSlides.id, id))
      .limit(1);
    return row ?? null;
  }

  private async activeCount(database: AppDatabase): Promise<number> {
    const [row] = await database
      .select({ value: count() })
      .from(heroSlides)
      .where(eq(heroSlides.active, true));
    return Number(row?.value ?? 0);
  }

  private assertActiveTransition(
    nextActive: boolean,
    activeCount: number,
    currentActive: boolean,
  ): void {
    if (nextActive && !currentActive && activeCount >= MAX_ACTIVE_SLIDES) {
      throw new ConflictException(
        'A maximum of 5 published hero slides is allowed',
      );
    }
    if (!nextActive && currentActive && activeCount <= 1) {
      throw new ConflictException(
        'At least one published hero slide is required',
      );
    }
    if (activeCount === 0 && !nextActive) {
      throw new ConflictException('The first hero slide must be published');
    }
  }

  private normalize(input: CreateHeroSlideDto | UpdateHeroSlideDto) {
    const fields = {
      tagline: input.tagline?.trim() || null,
      title: input.title?.trim(),
      subtitle: input.subtitle?.trim() || null,
      ctaPrimaryLabel: input.ctaPrimaryLabel?.trim(),
      ctaPrimaryHref: input.ctaPrimaryHref?.trim(),
      ctaSecondaryLabel: input.ctaSecondaryLabel?.trim(),
      ctaSecondaryHref: input.ctaSecondaryHref?.trim(),
      imageUrl: input.imageUrl?.trim(),
      imageKey: input.imageKey?.trim() || null,
      imageAlt: input.imageAlt?.trim() || input.title?.trim() || null,
      sortOrder: input.sortOrder,
    };
    for (const [field, value] of Object.entries(fields)) {
      if (value === '') throw new BadRequestException(`${field} is required`);
    }
    this.validateHref(fields.ctaPrimaryHref);
    this.validateHref(fields.ctaSecondaryHref);
    return fields;
  }

  private required(value: string | undefined, field: string): string {
    if (!value) throw new BadRequestException(`${field} is required`);
    return value;
  }

  private validateHref(value: string | undefined): void {
    if (!value) return;
    if (value.startsWith('/')) return;
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException(
        'CTA links must be relative paths or HTTPS URLs',
      );
    }
    if (url.protocol !== 'https:') {
      throw new BadRequestException('CTA links must use HTTPS');
    }
  }

  private response(row: HeroSlideRow): HeroSlideResponse {
    return {
      id: row.id,
      ...(row.tagline ? { tagline: row.tagline } : {}),
      title: row.title,
      ...(row.subtitle ? { subtitle: row.subtitle } : {}),
      ctaPrimaryLabel: row.ctaPrimaryLabel,
      ctaPrimaryHref: row.ctaPrimaryHref,
      ctaSecondaryLabel: row.ctaSecondaryLabel,
      ctaSecondaryHref: row.ctaSecondaryHref,
      imageUrl: row.imageUrl,
      ...(row.imageKey ? { imageKey: row.imageKey } : {}),
      imageAlt: row.imageAlt ?? row.title,
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
