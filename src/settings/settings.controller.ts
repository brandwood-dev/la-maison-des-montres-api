import { Body, Controller, Get, Header, Patch } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse } from '@nestjs/swagger';
import { ACCESS_COOKIE } from '../auth/auth.constants';
import { Public, RequirePermissions } from '../auth/auth.decorators';
import { UpdateStoreSettingsDto } from './settings.dto';
import { SettingsService } from './settings.service';

@Controller('api/v1/settings')
@RequirePermissions('settings.write')
@ApiCookieAuth(ACCESS_COOKIE)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @ApiOkResponse()
  get() {
    return this.settings.get();
  }

  @Patch()
  @ApiOkResponse()
  update(@Body() input: UpdateStoreSettingsDto) {
    return this.settings.update(input);
  }
}

@Controller('api/v1/public/settings')
export class PublicSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @Public()
  @Header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  @ApiOkResponse()
  get() {
    return this.settings.get();
  }
}
