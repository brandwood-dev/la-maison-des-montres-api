import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse } from '@nestjs/swagger';
import { ACCESS_COOKIE } from '../auth/auth.constants';
import { RequirePermissions } from '../auth/auth.decorators';
import { DashboardService } from './dashboard.service';
import { DashboardStatsQueryDto } from './dashboard.dto';

@Controller('api/v1/dashboard')
@RequirePermissions('dashboard.read')
@ApiCookieAuth(ACCESS_COOKIE)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('stats')
  @ApiOkResponse()
  stats(@Query() query: DashboardStatsQueryDto) {
    return this.dashboard.stats(query);
  }
}
