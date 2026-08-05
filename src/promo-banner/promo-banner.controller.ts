import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { ACCESS_COOKIE } from '../auth/auth.constants';
import { Public, RequirePermissions } from '../auth/auth.decorators';
import {
  CreatePromoBannerMessageDto,
  ListPromoBannerMessagesQueryDto,
  ReorderPromoBannerMessagesDto,
  UpdatePromoBannerMessageDto,
} from './promo-banner.dto';
import { PromoBannerService } from './promo-banner.service';

@Controller('api/v1/promo-banner-messages')
@RequirePermissions('content.write')
@ApiCookieAuth(ACCESS_COOKIE)
export class PromoBannerController {
  constructor(private readonly promoBanner: PromoBannerService) {}

  @Get()
  @ApiOkResponse()
  list(@Query() query: ListPromoBannerMessagesQueryDto) {
    return this.promoBanner.list(query);
  }

  @Get(':id')
  @ApiOkResponse()
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.promoBanner.get(id);
  }

  @Post()
  @ApiOkResponse()
  create(@Body() input: CreatePromoBannerMessageDto) {
    return this.promoBanner.create(input);
  }

  @Patch('reorder')
  @ApiOkResponse()
  reorder(@Body() input: ReorderPromoBannerMessagesDto) {
    return this.promoBanner.reorder(input);
  }

  @Patch(':id')
  @ApiOkResponse()
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdatePromoBannerMessageDto,
  ) {
    return this.promoBanner.update(id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.promoBanner.remove(id);
  }
}

@Controller('api/v1/public/promo-banner-messages')
export class PublicPromoBannerController {
  constructor(private readonly promoBanner: PromoBannerService) {}

  @Get()
  @Public()
  @ApiOkResponse()
  list() {
    return this.promoBanner.publicList();
  }
}
