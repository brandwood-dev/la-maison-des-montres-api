import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { ACCESS_COOKIE } from '../auth/auth.constants';
import { RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { NotificationsService } from './notifications.service';

@Controller('api/v1/notifications')
@RequirePermissions('notifications.read')
@ApiCookieAuth(ACCESS_COOKIE)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOkResponse()
  list(@Req() request: AuthenticatedRequest) {
    return this.notifications.list(request.admin?.id ?? '');
  }

  @Patch(':id/read')
  @HttpCode(204)
  @ApiNoContentResponse()
  async markRead(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.notifications.markRead(request.admin?.id ?? '', id);
  }

  @Post('read-all')
  @HttpCode(204)
  @ApiNoContentResponse()
  async markAllRead(@Req() request: AuthenticatedRequest): Promise<void> {
    await this.notifications.markAllRead(request.admin?.id ?? '');
  }

  @Delete(':id/read')
  @HttpCode(204)
  @ApiNoContentResponse()
  async markUnread(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.notifications.markUnread(request.admin?.id ?? '', id);
  }
}
