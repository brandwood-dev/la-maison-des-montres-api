import { Module } from '@nestjs/common';
import { CloudflareAccessService } from './cloudflare-access.service';

@Module({
  providers: [CloudflareAccessService],
  exports: [CloudflareAccessService],
})
export class AccessModule {}
