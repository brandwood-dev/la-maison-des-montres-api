import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AccessModule } from './access/access.module';
import { AdminAuthGuard } from './auth/auth.guard';
import { AuthModule } from './auth/auth.module';
import { PermissionsGuard } from './auth/permissions.guard';
import { CatalogModule } from './catalog/catalog.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HttpLoggingInterceptor } from './common/http-logging.interceptor';
import { environmentSchema } from './config/environment';
import { DatabaseModule } from './database/database.module';
import { EmailModule } from './email/email.module';
import { MediaModule } from './media/media.module';
import { OrdersModule } from './orders/orders.module';
import { ProfileModule } from './profile/profile.module';
import { TeamModule } from './team/team.module';
import { getThrottlerTracker } from './common/throttling';
import { HeroModule } from './hero/hero.module';
import { PromoBannerModule } from './promo-banner/promo-banner.module';
import { SearchModule } from './search/search.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validationSchema: environmentSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    ThrottlerModule.forRoot([
      { ttl: 60_000, limit: 120, getTracker: getThrottlerTracker },
    ]),
    AccessModule,
    DatabaseModule,
    EmailModule,
    AuthModule,
    CatalogModule,
    DashboardModule,
    MediaModule,
    OrdersModule,
    ProfileModule,
    TeamModule,
    HeroModule,
    PromoBannerModule,
    SearchModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: AdminAuthGuard },
    { provide: APP_GUARD, useExisting: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: HttpLoggingInterceptor },
  ],
})
export class AppModule {}
