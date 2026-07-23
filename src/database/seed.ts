import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { sql } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { AuthService } from '../auth/auth.service';
import { DATABASE } from './database.constants';
import type { AppDatabase } from './database.types';
import { adminUsers } from './schema';

async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  try {
    const config = app.get(ConfigService);
    if (
      config.getOrThrow<string>('NODE_ENV') === 'production' ||
      !config.getOrThrow<boolean>('DEV_SEED_ENABLED')
    ) {
      throw new Error(
        'Development seed is disabled; set DEV_SEED_ENABLED outside production',
      );
    }
    const email = config.getOrThrow<string>('DEV_SEED_SUPER_ADMIN_EMAIL');
    const password = config.getOrThrow<string>('DEV_SEED_SUPER_ADMIN_PASSWORD');
    const database = app.get<AppDatabase | null>(DATABASE);
    if (!database) throw new Error('Database is not configured');

    const existing = await database
      .select({ id: adminUsers.id })
      .from(adminUsers)
      .where(sql`lower(${adminUsers.email}) = ${email.toLowerCase()}`)
      .limit(1);
    if (existing.length) {
      console.log('Development super admin already exists');
      return;
    }

    await database.insert(adminUsers).values({
      email: email.toLowerCase(),
      passwordHash: await AuthService.hashPassword(password),
      firstName: 'Admin',
      lastName: 'Development',
      role: 'super_admin',
      status: 'active',
    });
    console.log('Development super admin created');
  } finally {
    await app.close();
  }
}

void seed();
