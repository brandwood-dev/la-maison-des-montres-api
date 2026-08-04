import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse } from '@nestjs/swagger';
import { ACCESS_COOKIE } from '../auth/auth.constants';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { NotificationPreferencesDto, UpdateProfileDto } from './profile.dto';
import { ProfileService } from './profile.service';

@Controller('api/v1/profile')
@ApiCookieAuth(ACCESS_COOKIE)
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  @ApiOkResponse()
  get(@Req() request: AuthenticatedRequest) {
    return this.profile.get(request.admin?.id ?? '');
  }

  @Patch()
  @ApiOkResponse()
  update(
    @Req() request: AuthenticatedRequest,
    @Body() input: UpdateProfileDto,
  ) {
    return this.profile.update(request.admin?.id ?? '', input);
  }

  @Patch('notifications')
  @ApiOkResponse()
  updateNotifications(
    @Req() request: AuthenticatedRequest,
    @Body() input: NotificationPreferencesDto,
  ) {
    return this.profile.updateNotifications(request.admin?.id ?? '', input);
  }
}
