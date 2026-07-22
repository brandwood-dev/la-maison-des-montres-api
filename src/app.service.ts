import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok' as const,
      service: 'la-maison-des-montres-api' as const,
    };
  }
}
