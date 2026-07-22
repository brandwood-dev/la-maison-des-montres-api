import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'test', 'production')
          .default('development'),
        PORT: Joi.number().port().default(3000),
        FRONTEND_URL: Joi.string()
          .uri()
          .default('https://lamaisondesmontres.com'),
        LOCAL_FRONTEND_URL: Joi.string().uri().default('http://localhost:3000'),
        DATABASE_URL: Joi.string().uri().optional(),
        SUPABASE_URL: Joi.string().uri().optional(),
        SUPABASE_PUBLISHABLE_KEY: Joi.string().optional(),
        SUPABASE_SECRET_KEY: Joi.string().optional(),
      }),
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
