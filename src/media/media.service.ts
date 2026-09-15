import {
  BadRequestException,
  Logger,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { publicImageVariants } from './media-url';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);

type StorageBucket = ReturnType<SupabaseClient['storage']['from']>;
type SignedUploadResult = Awaited<
  ReturnType<StorageBucket['createSignedUploadUrl']>
>;

export type ProductMediaUploadInput = {
  fileName: string;
  contentType: string;
  sizeBytes: number;
};

export type ProductMediaUploadTicket = {
  provider: 'supabase';
  key: string;
  publicUrl: string;
  uploadUrl: string;
  method: 'PUT';
  headers: { 'content-type': string };
  expiresAt: string;
  optimizedUrl?: string;
  srcSet?: string;
  sizes?: string;
};

@Injectable()
export class MediaService {
  private client: SupabaseClient | null = null;
  private readonly logger = new Logger(MediaService.name);

  constructor(private readonly config: ConfigService) {}

  async createProductUploadTicket(
    input: ProductMediaUploadInput,
  ): Promise<ProductMediaUploadTicket> {
    this.validateInput(input, MAX_IMAGE_SIZE);
    return this.createUploadTicket(input, 'products');
  }

  async createBrandUploadTicket(
    input: ProductMediaUploadInput,
  ): Promise<ProductMediaUploadTicket> {
    this.validateInput(input, MAX_IMAGE_SIZE);
    return this.createUploadTicket(input, 'brand-logos');
  }

  async createAdminAvatarUploadTicket(
    input: ProductMediaUploadInput,
  ): Promise<ProductMediaUploadTicket> {
    this.validateInput(input, MAX_AVATAR_SIZE);
    return this.createUploadTicket(input, 'admin-avatars');
  }

  async createHeroUploadTicket(
    input: ProductMediaUploadInput,
  ): Promise<ProductMediaUploadTicket> {
    this.validateInput(input, MAX_IMAGE_SIZE);
    if (input.contentType !== 'image/webp') {
      throw new BadRequestException(
        'Hero uploads must be converted to WebP first',
      );
    }
    return this.createUploadTicket(input, 'hero');
  }

  private async createUploadTicket(
    input: ProductMediaUploadInput,
    prefix: string,
  ): Promise<ProductMediaUploadTicket> {
    const bucket = this.config.getOrThrow<string>('SUPABASE_STORAGE_BUCKET');
    // Never trust a user-provided filename extension. Derive the key suffix
    // from the validated MIME type so uploaded objects cannot carry a
    // misleading or executable-looking extension.
    const extension = this.extensionFor(input.contentType);
    const key = `${prefix}/${randomUUID()}${extension}`;
    const storage = this.getClient().storage.from(bucket);
    const { data, error } = await this.createSignedUploadUrl(storage, key, {
      bucket,
      prefix,
    });

    if (error || !data) {
      this.logger.error(
        JSON.stringify({
          event: 'media_upload_ticket_failed',
          bucket,
          prefix,
          provider: this.storageErrorSummary(error),
        }),
      );
      throw new ServiceUnavailableException(
        'Impossible de préparer le stockage image',
      );
    }

    const publicUrl = storage.getPublicUrl(key).data.publicUrl;
    const variants = publicImageVariants(publicUrl);
    return {
      provider: 'supabase',
      key,
      publicUrl,
      uploadUrl: data.signedUrl,
      method: 'PUT',
      headers: { 'content-type': input.contentType },
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      ...(variants ?? {}),
    };
  }

  private async createSignedUploadUrl(
    storage: StorageBucket,
    key: string,
    context: { bucket: string; prefix: string },
  ): Promise<SignedUploadResult> {
    let result: SignedUploadResult | undefined;
    let failure: unknown;

    // Storage can briefly reject requests while Supabase or a Render instance
    // is waking up. Retry only transient failures; never repeat a permanent
    // configuration or validation error.
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        result = await storage.createSignedUploadUrl(key, { upsert: false });
        failure = result.error;
      } catch (error) {
        failure = error;
      }

      if (
        result?.data ||
        !this.isTransientStorageError(failure) ||
        attempt === 2
      ) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    if (result) return result;

    this.logger.error(
      JSON.stringify({
        event: 'media_upload_ticket_provider_exception',
        bucket: context.bucket,
        prefix: context.prefix,
        provider: this.storageErrorSummary(failure),
      }),
    );

    // Keep the public API contract stable while allowing the caller to return
    // the same sanitized 503 response for thrown provider/network errors.
    return {
      data: null,
      error: failure,
    } as SignedUploadResult;
  }

  private isTransientStorageError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return true;
    const value = error as { statusCode?: unknown; status?: unknown };
    const status = Number(value.statusCode ?? value.status);
    return (
      !Number.isFinite(status) ||
      status === 408 ||
      status === 429 ||
      status >= 500
    );
  }

  private storageErrorSummary(error: unknown): Record<string, unknown> {
    if (!error || typeof error !== 'object') {
      return { type: typeof error };
    }
    const value = error as {
      name?: unknown;
      statusCode?: unknown;
      status?: unknown;
      message?: unknown;
    };
    const message =
      typeof value.message === 'string'
        ? value.message.replace(/https?:\/\/\S+/gi, '[url]').slice(0, 160)
        : undefined;
    return {
      name: typeof value.name === 'string' ? value.name : undefined,
      statusCode: value.statusCode ?? value.status,
      message,
    };
  }

  private getClient(): SupabaseClient {
    if (!this.client) {
      const url = this.config.get<string>('SUPABASE_URL');
      const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
      if (!url || !key) {
        throw new ServiceUnavailableException('Stockage image non configuré');
      }
      this.client = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }
    return this.client;
  }

  private validateInput(input: ProductMediaUploadInput, maxSize: number): void {
    if (!ALLOWED_IMAGE_TYPES.has(input.contentType)) {
      throw new BadRequestException('Type d’image non pris en charge');
    }
    if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes < 1) {
      throw new BadRequestException('Taille d’image invalide');
    }
    if (input.sizeBytes > maxSize) {
      throw new BadRequestException(
        `Image trop volumineuse (${maxSize / (1024 * 1024)} Mo maximum)`,
      );
    }
    if (!input.fileName || input.fileName.length > 255) {
      throw new BadRequestException('Nom de fichier invalide');
    }
  }

  private extensionFor(contentType: string): string {
    return (
      {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
        'image/avif': '.avif',
      }[contentType] ?? '.bin'
    );
  }
}
