import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './auth/auth.constants';
import { AppModule } from './app.module';
import { JsonLogger } from './common/json-logger';
import { parseOrigins } from './config/environment';
import { configureApp } from './configure-app';

export async function createApp() {
  const app = await NestFactory.create(AppModule, {
    logger: new JsonLogger(),
  });
  const config = app.get(ConfigService);
  const origins = parseOrigins(config.get<string>('CORS_ORIGINS'));

  configureApp(app, origins);
  if (
    config.getOrThrow<string>('NODE_ENV') !== 'production' &&
    config.getOrThrow<boolean>('SWAGGER_ENABLED')
  ) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('La Maison des Montres API')
      .setVersion('1')
      .addCookieAuth(ACCESS_COOKIE, undefined, ACCESS_COOKIE)
      .addCookieAuth(REFRESH_COOKIE, undefined, REFRESH_COOKIE)
      .build();
    SwaggerModule.setup(
      'docs',
      app,
      SwaggerModule.createDocument(app, swaggerConfig),
    );
  }
  return app;
}
