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
        return postgres(url, {
          prepare: false,
          max: config.getOrThrow<string>('NODE_ENV') === 'production' ? 1 : 5,
          idle_timeout: 20,
          connect_timeout: 10,
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
