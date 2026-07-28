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
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { Public, RequirePermissions } from '../auth/auth.decorators';
import { ACCESS_COOKIE } from '../auth/auth.constants';
import { CatalogService } from './catalog.service';
import {
  CreateAttributeDto,
  CreateAttributeValueDto,
  CreateBrandDto,
  CreateCategoryDto,
  CreateProductDto,
  ListQueryDto,
  ProductListQueryDto,
  PublicProductListQueryDto,
  ReorderCategoriesDto,
  UpdateAttributeDto,
  UpdateAttributeValueDto,
  UpdateBrandDto,
  UpdateCategoryDto,
  UpdateProductDto,
  UpdateProductStatusDto,
} from './dto/catalog.dto';
import {
  AttributePageResponseDto,
  AttributeResponseDto,
  AttributeValueResponseDto,
  BrandPageResponseDto,
  BrandResponseDto,
  CategoryPageResponseDto,
  CategoryResponseDto,
  ProductPageResponseDto,
  ProductResponseDto,
} from './dto/catalog-response.dto';

@Controller('api/v1/brands')
@RequirePermissions('products.read')
@ApiCookieAuth(ACCESS_COOKIE)
export class BrandsController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ApiOkResponse({ type: BrandPageResponseDto })
  list(@Query() query: ListQueryDto) {
    return this.catalog.listBrands(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: BrandResponseDto })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.getBrand(id);
  }

  @Post()
  @RequirePermissions('products.write')
  @ApiCreatedResponse({ type: BrandResponseDto })
  create(@Body() input: CreateBrandDto) {
    return this.catalog.createBrand(input);
  }

  @Patch(':id')
  @RequirePermissions('products.write')
  @ApiOkResponse({ type: BrandResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateBrandDto,
  ) {
    return this.catalog.updateBrand(id, input);
  }

  @Delete(':id')
  @RequirePermissions('products.write')
  @HttpCode(204)
  @ApiNoContentResponse()
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.deleteBrand(id);
  }
}

@Controller('api/v1/categories')
@RequirePermissions('products.read')
@ApiCookieAuth(ACCESS_COOKIE)
export class CategoriesController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ApiOkResponse({ type: CategoryPageResponseDto })
  list(@Query() query: ListQueryDto) {
    return this.catalog.listCategories(query);
  }

  @Patch('reorder')
  @RequirePermissions('categories.write')
  @ApiOkResponse({ type: CategoryResponseDto, isArray: true })
  reorder(@Body() input: ReorderCategoriesDto) {
    return this.catalog.reorderCategories(input);
  }

  @Get(':id')
  @ApiOkResponse({ type: CategoryResponseDto })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.getCategory(id);
  }

  @Post()
  @RequirePermissions('categories.write')
  @ApiCreatedResponse({ type: CategoryResponseDto })
  create(@Body() input: CreateCategoryDto) {
    return this.catalog.createCategory(input);
  }

  @Patch(':id')
  @RequirePermissions('categories.write')
  @ApiOkResponse({ type: CategoryResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateCategoryDto,
  ) {
    return this.catalog.updateCategory(id, input);
  }

  @Delete(':id')
  @RequirePermissions('categories.write')
  @HttpCode(204)
  @ApiNoContentResponse()
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.deleteCategory(id);
  }
}

@Controller('api/v1/attributes')
@RequirePermissions('products.read')
@ApiCookieAuth(ACCESS_COOKIE)
export class AttributesController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ApiOkResponse({ type: AttributePageResponseDto })
  list(@Query() query: ListQueryDto) {
    return this.catalog.listAttributes(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: AttributeResponseDto })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.getAttribute(id);
  }

  @Post()
  @RequirePermissions('attributes.write')
  @ApiCreatedResponse({ type: AttributeResponseDto })
  create(@Body() input: CreateAttributeDto) {
    return this.catalog.createAttribute(input);
  }

  @Patch(':id')
  @RequirePermissions('attributes.write')
  @ApiOkResponse({ type: AttributeResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateAttributeDto,
  ) {
    return this.catalog.updateAttribute(id, input);
  }

  @Delete(':id')
  @RequirePermissions('attributes.write')
  @HttpCode(204)
  @ApiNoContentResponse()
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.deleteAttribute(id);
  }

  @Get(':id/values')
  @ApiOkResponse({ type: AttributeValueResponseDto, isArray: true })
  values(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.listAttributeValues(id);
  }

  @Post(':id/values')
  @RequirePermissions('attributes.write')
  @ApiCreatedResponse({ type: AttributeValueResponseDto })
  createValue(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CreateAttributeValueDto,
  ) {
    return this.catalog.createAttributeValue(id, input);
  }
}

@Controller('api/v1/attribute-values')
@RequirePermissions('products.read')
@ApiCookieAuth(ACCESS_COOKIE)
export class AttributeValuesController {
  constructor(private readonly catalog: CatalogService) {}

  @Get(':id')
  @ApiOkResponse({ type: AttributeValueResponseDto })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.getAttributeValue(id);
  }

  @Patch(':id')
  @RequirePermissions('attributes.write')
  @ApiOkResponse({ type: AttributeValueResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateAttributeValueDto,
  ) {
    return this.catalog.updateAttributeValue(id, input);
  }

  @Delete(':id')
  @RequirePermissions('attributes.write')
  @HttpCode(204)
  @ApiNoContentResponse()
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.deleteAttributeValue(id);
  }
}

@Controller('api/v1/products')
@RequirePermissions('products.read')
@ApiCookieAuth(ACCESS_COOKIE)
export class ProductsController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ApiOkResponse({ type: ProductPageResponseDto })
  list(@Query() query: ProductListQueryDto) {
    return this.catalog.listProducts(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: ProductResponseDto })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.getProduct(id);
  }

  @Post()
  @RequirePermissions('products.write')
  @ApiCreatedResponse({ type: ProductResponseDto })
  create(@Body() input: CreateProductDto) {
    return this.catalog.createProduct(input);
  }

  @Patch(':id')
  @RequirePermissions('products.write')
  @ApiOkResponse({ type: ProductResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateProductDto,
  ) {
    return this.catalog.updateProduct(id, input);
  }

  @Patch(':id/status')
  @RequirePermissions('products.write')
  @ApiOkResponse({ type: ProductResponseDto })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateProductStatusDto,
  ) {
    return this.catalog.updateProduct(id, { status: input.status });
  }

  @Delete(':id')
  @RequirePermissions('products.write')
  @HttpCode(204)
  @ApiNoContentResponse()
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.deleteProduct(id);
  }
}

@Controller('api/v1/public/products')
@Public()
export class PublicProductsController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ApiOkResponse()
  list(@Query() query: PublicProductListQueryDto) {
    return this.catalog.listPublicProducts(query);
  }

  @Get(':slug')
  @ApiOkResponse()
  get(@Param('slug') slug: string) {
    return this.catalog.getPublicProduct(slug);
  }
}

@Controller('api/v1/public/brands')
@Public()
export class PublicBrandsController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ApiOkResponse({ type: BrandPageResponseDto })
  list(@Query() query: ListQueryDto) {
    return this.catalog.listPublicBrands(query);
  }
}

@Controller('api/v1/public/categories')
@Public()
export class PublicCategoriesController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ApiOkResponse({ type: CategoryPageResponseDto })
  list(@Query() query: ListQueryDto) {
    return this.catalog.listPublicCategories(query);
  }
}
