import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);

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
};

@Injectable()
export class MediaService {
  private client: SupabaseClient | null = null;

  constructor(private readonly config: ConfigService) {}

  async createProductUploadTicket(
    input: ProductMediaUploadInput,
  ): Promise<ProductMediaUploadTicket> {
    this.validateInput(input, MAX_IMAGE_SIZE);
    return this.createUploadTicket(input, 'products');
  }

  async createAdminAvatarUploadTicket(
    input: ProductMediaUploadInput,
  ): Promise<ProductMediaUploadTicket> {
    this.validateInput(input, MAX_AVATAR_SIZE);
    return this.createUploadTicket(input, 'admin-avatars');
  }

  private async createUploadTicket(
    input: ProductMediaUploadInput,
    prefix: string,
  ): Promise<ProductMediaUploadTicket> {
    const bucket = this.config.getOrThrow<string>('SUPABASE_STORAGE_BUCKET');
    const extension = extname(input.fileName).toLowerCase();
    const key = `${prefix}/${randomUUID()}${extension || this.extensionFor(input.contentType)}`;
    const storage = this.getClient().storage.from(bucket);
    const { data, error } = await storage.createSignedUploadUrl(key, {
      upsert: false,
    });

    if (error || !data) {
      throw new ServiceUnavailableException(
        'Impossible de préparer le stockage image',
      );
    }

    const publicUrl = storage.getPublicUrl(key).data.publicUrl;
    return {
      provider: 'supabase',
      key,
      publicUrl,
      uploadUrl: data.signedUrl,
      method: 'PUT',
      headers: { 'content-type': input.contentType },
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
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
