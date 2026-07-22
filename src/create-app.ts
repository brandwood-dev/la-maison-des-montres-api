import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

export async function createApp() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const origins = [config.getOrThrow<string>('FRONTEND_URL')];

  if (config.getOrThrow<string>('NODE_ENV') !== 'production') {
    origins.push(config.getOrThrow<string>('LOCAL_FRONTEND_URL'));
  }

  configureApp(app, origins);
  return app;
}
