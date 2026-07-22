import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

export function configureApp(app: INestApplication, origins: string[]): void {
  app.use(helmet());
  app.enableCors({ origin: origins, credentials: false });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
