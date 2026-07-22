import { ConfigService } from '@nestjs/config';
import { createApp } from './create-app';

async function bootstrap() {
  const app = await createApp();
  const config = app.get(ConfigService);

  await app.listen(config.getOrThrow<number>('PORT'));
}
void bootstrap();
