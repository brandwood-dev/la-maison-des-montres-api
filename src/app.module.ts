import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminAuthGuard } from './auth/auth.guard';
import { AuthModule } from './auth/auth.module';
import { PermissionsGuard } from './auth/permissions.guard';
import { CatalogModule } from './catalog/catalog.module';
import { HttpLoggingInterceptor } from './common/http-logging.interceptor';
import { environmentSchema } from './config/environment';
import { DatabaseModule } from './database/database.module';
import { EmailModule } from './email/email.module';
import { MediaModule } from './media/media.module';
import { OrdersModule } from './orders/orders.module';

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
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    DatabaseModule,
    EmailModule,
    AuthModule,
    CatalogModule,
    MediaModule,
    OrdersModule,
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
