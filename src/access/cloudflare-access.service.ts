import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';
const CLOUDFLARE_TIMEOUT_MS = 7_000;

type AccessRule = {
  email?: { email?: string };
  [key: string]: unknown;
};

type AccessGroup = {
  name: string;
  include?: AccessRule[];
  exclude?: AccessRule[];
  require?: AccessRule[];
  is_default?: boolean;
};

type CloudflareResponse<T> = {
  success?: boolean;
  result?: T;
};

@Injectable()
export class CloudflareAccessService {
  private readonly logger = new Logger(CloudflareAccessService.name);

  constructor(private readonly config: ConfigService) {}

  async setEmailAccess(email: string, enabled: boolean): Promise<void> {
    const credentials = this.credentials();
    if (!credentials) return;

    const group = await this.request<AccessGroup>(
      credentials,
      'GET',
      `/accounts/${credentials.accountId}/access/groups/${credentials.groupId}`,
    );
    const normalizedEmail = email.trim().toLowerCase();
    const current = group.include ?? [];
    const hasEmail = current.some(
      (rule) => rule.email?.email?.trim().toLowerCase() === normalizedEmail,
    );
    if (hasEmail === enabled) return;

    const include = enabled
      ? [...current, { email: { email: normalizedEmail } }]
      : current.filter(
          (rule) => rule.email?.email?.trim().toLowerCase() !== normalizedEmail,
        );

    await this.request<AccessGroup>(
      credentials,
      'PUT',
      `/accounts/${credentials.accountId}/access/groups/${credentials.groupId}`,
      {
        name: group.name,
        include,
        exclude: group.exclude ?? [],
        require: group.require ?? [],
        ...(group.is_default === undefined
          ? {}
          : { is_default: group.is_default }),
      },
    );
  }

  private credentials(): {
    accountId: string;
    groupId: string;
    apiToken: string;
  } | null {
    const accountId = this.config.get<string>('CLOUDFLARE_ACCOUNT_ID');
    const groupId = this.config.get<string>('CLOUDFLARE_ACCESS_GROUP_ID');
    const apiToken = this.config.get<string>('CLOUDFLARE_API_TOKEN');
    if (!accountId && !groupId && !apiToken) return null;
    if (!accountId || !groupId || !apiToken) {
      throw new ServiceUnavailableException(
        'Cloudflare Access integration is misconfigured',
      );
    }
    return { accountId, groupId, apiToken };
  }

  private async request<T>(
    credentials: { accountId: string; groupId: string; apiToken: string },
    method: 'GET' | 'PUT',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CLOUDFLARE_TIMEOUT_MS);
    try {
      const response = await fetch(`${CLOUDFLARE_API_BASE}${path}`, {
        method,
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${credentials.apiToken}`,
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });
      const payload = (await response.json()) as CloudflareResponse<T>;
      if (
        !response.ok ||
        payload.success === false ||
        payload.result === undefined
      ) {
        throw new Error(`Cloudflare Access returned HTTP ${response.status}`);
      }
      return payload.result;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.warn(
        `Cloudflare Access synchronization failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      throw new ServiceUnavailableException(
        'Cloudflare Access synchronization failed',
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
