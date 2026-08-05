import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../auth/auth.decorators';
import { MetaFeedService } from './meta-feed.service';

@Controller('api/feeds')
@Public()
export class MetaFeedController {
  constructor(private readonly feed: MetaFeedService) {}

  @Get('meta-products.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Cache-Control',
    'public, max-age=60, s-maxage=300, stale-while-revalidate=60',
  )
  @Header('Content-Disposition', 'inline; filename="meta-products.csv"')
  @Header('X-Content-Type-Options', 'nosniff')
  getFeed(): Promise<string> {
    return this.feed.generateCsv();
  }
}
