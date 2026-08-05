import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse } from '@nestjs/swagger';
import { ACCESS_COOKIE } from '../auth/auth.constants';
import { RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { SearchQueryDto } from './search.dto';
import { SearchService } from './search.service';

@Controller('api/v1/admin/search')
@RequirePermissions('products.read')
@ApiCookieAuth(ACCESS_COOKIE)
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  @ApiOkResponse()
  searchAll(
    @Query() query: SearchQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.search.search(query, request.permissions);
  }
}
