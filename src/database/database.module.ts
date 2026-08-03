import {
  Global,
  Inject,
  Injectable,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import { DATABASE, DATABASE_CLIENT } from './database.constants';
import * as schema from './schema';

const SERVERLESS_DATABASE_OPTIONS = {
  // Keep one stalled socket from blocking every request in a warm Vercel
  // invocation. Supavisor transaction pooling is designed for this small
  // per-instance pool and remains the source of truth for connection limits.
  max: 2,
  idle_timeout: 10,
  max_lifetime: 60,
  connect_timeout: 5,
  keep_alive: 10,
  connection: {
    // Fail before the Admin proxy (12 s) gives up, so the API can return a
    // bounded error and the next request can use a fresh pooled connection.
    statement_timeout: 8_000,
    lock_timeout: 3_000,
    idle_in_transaction_session_timeout: 8_000,
  },
} as const;

@Injectable()
class DatabaseLifecycle implements OnApplicationShutdown {
  constructor(@Inject(DATABASE_CLIENT) private readonly client: Sql | null) {}

  async onApplicationShutdown(): Promise<void> {
    if (this.client) await this.client.end({ timeout: 5 });
  }
}

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('DATABASE_URL');
        if (!url) {
          return null;
        }
        const isProduction =
          config.getOrThrow<string>('NODE_ENV') === 'production';

        return postgres(url, {
          prepare: false,
          ...(isProduction
            ? SERVERLESS_DATABASE_OPTIONS
            : {
                max: 5,
                idle_timeout: 20,
                connect_timeout: 10,
              }),
        });
      },
    },
    {
      provide: DATABASE,
      inject: [DATABASE_CLIENT],
      useFactory: (client: Sql | null) =>
        client ? drizzle(client, { schema }) : null,
    },
    DatabaseLifecycle,
  ],
  exports: [DATABASE],
})
export class DatabaseModule {}
