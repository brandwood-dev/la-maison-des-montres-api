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
  CreateTestimonialDto,
  ListTestimonialsQueryDto,
  UpdateTestimonialDto,
} from './testimonials.dto';
import { TestimonialsService } from './testimonials.service';

@Controller('api/v1/testimonials')
@RequirePermissions('reviews.moderate')
@ApiCookieAuth(ACCESS_COOKIE)
export class TestimonialsController {
  constructor(private readonly testimonials: TestimonialsService) {}

  @Get()
  @ApiOkResponse()
  list(@Query() query: ListTestimonialsQueryDto) {
    return this.testimonials.list(query);
  }

  @Get(':id')
  @ApiOkResponse()
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.testimonials.get(id);
  }

  @Post()
  @ApiOkResponse()
  create(@Body() input: CreateTestimonialDto) {
    return this.testimonials.create(input);
  }

  @Patch(':id')
  @ApiOkResponse()
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateTestimonialDto,
  ) {
    return this.testimonials.update(id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.testimonials.remove(id);
  }
}

@Controller('api/v1/public/testimonials')
@Public()
export class PublicTestimonialsController {
  constructor(private readonly testimonials: TestimonialsService) {}

  @Get()
  @ApiOkResponse()
  list() {
    return this.testimonials.publicList();
  }
}
