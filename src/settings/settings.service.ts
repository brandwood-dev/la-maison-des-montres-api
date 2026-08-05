import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants';
import type { AppDatabase } from '../database/database.types';
import { storeSettings, type StoreSettingsRow } from '../database/schema';
import type { UpdateStoreSettingsDto } from './settings.dto';

export type StoreSettingsResponse = {
  identity: {
    name: string;
    tagline?: string;
    logoUrl?: string;
    currency: 'TND';
  };
  support: {
    email: string;
    phone: string;
    whatsapp: string;
    address?: string;
  };
  seo: {
    defaultTitle: string;
    defaultDescription: string;
  };
  updatedAt: string;
};

const SETTINGS_ID = 'default';

@Injectable()
export class SettingsService {
  constructor(
    @Inject(DATABASE) private readonly database: AppDatabase | null,
  ) {}

  async get(): Promise<StoreSettingsResponse> {
    const [row] = await this.getDatabase()
      .select()
      .from(storeSettings)
      .where(eq(storeSettings.id, SETTINGS_ID))
      .limit(1);
    if (!row) {
      throw new ServiceUnavailableException(
        'Store settings are not configured',
      );
    }
    return this.response(row);
  }

  async update(input: UpdateStoreSettingsDto): Promise<StoreSettingsResponse> {
    const database = this.getDatabase();
    const [current] = await database
      .select()
      .from(storeSettings)
      .where(eq(storeSettings.id, SETTINGS_ID))
      .limit(1);
    if (!current) {
      throw new ServiceUnavailableException(
        'Store settings are not configured',
      );
    }

    const patch = {
      ...(input.identity?.name !== undefined
        ? { identityName: this.required(input.identity.name, 'identity.name') }
        : {}),
      ...(input.identity?.tagline !== undefined
        ? { identityTagline: this.optional(input.identity.tagline) }
        : {}),
      ...(input.identity?.logoUrl !== undefined
        ? { identityLogoUrl: this.logoUrl(input.identity.logoUrl) }
        : {}),
      ...(input.support?.email !== undefined
        ? { supportEmail: this.optional(input.support.email) }
        : {}),
      ...(input.support?.phone !== undefined
        ? { supportPhone: this.optional(input.support.phone) }
        : {}),
      ...(input.support?.whatsapp !== undefined
        ? { supportWhatsapp: this.optional(input.support.whatsapp) }
        : {}),
      ...(input.support?.address !== undefined
        ? { supportAddress: this.optional(input.support.address) }
        : {}),
      ...(input.seo?.defaultTitle !== undefined
        ? {
            seoDefaultTitle: this.required(
              input.seo.defaultTitle,
              'seo.defaultTitle',
            ),
          }
        : {}),
      ...(input.seo?.defaultDescription !== undefined
        ? {
            seoDefaultDescription: this.required(
              input.seo.defaultDescription,
              'seo.defaultDescription',
            ),
          }
        : {}),
      updatedAt: new Date(),
    };

    const [updated] = await database
      .update(storeSettings)
      .set(patch)
      .where(eq(storeSettings.id, current.id))
      .returning();
    if (!updated) {
      throw new ServiceUnavailableException(
        'Store settings could not be saved',
      );
    }
    return this.response(updated);
  }

  private response(row: StoreSettingsRow): StoreSettingsResponse {
    return {
      identity: {
        name: row.identityName,
        ...(row.identityTagline ? { tagline: row.identityTagline } : {}),
        ...(row.identityLogoUrl ? { logoUrl: row.identityLogoUrl } : {}),
        currency: 'TND',
      },
      support: {
        email: row.supportEmail ?? '',
        phone: row.supportPhone ?? '',
        whatsapp: row.supportWhatsapp ?? '',
        ...(row.supportAddress ? { address: row.supportAddress } : {}),
      },
      seo: {
        defaultTitle: row.seoDefaultTitle,
        defaultDescription: row.seoDefaultDescription,
      },
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private required(value: string, field: string): string {
    const cleaned = value.trim();
    if (!cleaned) throw new BadRequestException(field + ' is required');
    return cleaned;
  }

  private optional(value: string): string | null {
    const cleaned = value.trim();
    return cleaned || null;
  }

  private logoUrl(value: string): string | null {
    const cleaned = value.trim();
    if (!cleaned) return null;
    if (cleaned.startsWith('/')) return cleaned;
    try {
      const url = new URL(cleaned);
      if (url.protocol !== 'https:') {
        throw new Error('invalid protocol');
      }
      return url.toString();
    } catch {
      throw new BadRequestException(
        'identity.logoUrl must be an HTTPS URL or a local path',
      );
    }
  }

  private getDatabase(): AppDatabase {
    if (!this.database) {
      throw new ServiceUnavailableException('Database is not configured');
    }
    return this.database;
  }
}
