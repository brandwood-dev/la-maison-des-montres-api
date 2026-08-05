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
  CreateHeroSlideDto,
  ListHeroSlidesQueryDto,
  ReorderHeroSlidesDto,
  UpdateHeroSlideDto,
} from './hero.dto';
import { HeroService } from './hero.service';

@Controller('api/v1/hero-slides')
@RequirePermissions('content.write')
@ApiCookieAuth(ACCESS_COOKIE)
export class HeroController {
  constructor(private readonly hero: HeroService) {}

  @Get()
  @ApiOkResponse()
  list(@Query() query: ListHeroSlidesQueryDto) {
    return this.hero.list(query);
  }

  @Get(':id')
  @ApiOkResponse()
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.hero.get(id);
  }

  @Post()
  @ApiOkResponse()
  create(@Body() input: CreateHeroSlideDto) {
    return this.hero.create(input);
  }

  @Patch('reorder')
  @ApiOkResponse()
  reorder(@Body() input: ReorderHeroSlidesDto) {
    return this.hero.reorder(input);
  }

  @Patch(':id')
  @ApiOkResponse()
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateHeroSlideDto,
  ) {
    return this.hero.update(id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.hero.remove(id);
  }
}

@Controller('api/v1/public/hero-slides')
export class PublicHeroController {
  constructor(private readonly hero: HeroService) {}

  @Get()
  @Public()
  @ApiOkResponse()
  list() {
    return this.hero.publicList();
  }
}
