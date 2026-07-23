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
import { RequirePermissions } from '../auth/auth.decorators';
import { CatalogService } from './catalog.service';
import {
  CreateAttributeDto,
  CreateAttributeValueDto,
  CreateBrandDto,
  CreateCategoryDto,
  CreateProductDto,
  ListQueryDto,
  ProductListQueryDto,
  ReorderCategoriesDto,
  UpdateAttributeDto,
  UpdateAttributeValueDto,
  UpdateBrandDto,
  UpdateCategoryDto,
  UpdateProductDto,
  UpdateProductStatusDto,
} from './dto/catalog.dto';

@Controller('api/v1/brands')
@RequirePermissions('products.read')
export class BrandsController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(@Query() query: ListQueryDto) {
    return this.catalog.listBrands(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.getBrand(id);
  }

  @Post()
  @RequirePermissions('products.write')
  create(@Body() input: CreateBrandDto) {
    return this.catalog.createBrand(input);
  }

  @Patch(':id')
  @RequirePermissions('products.write')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateBrandDto,
  ) {
    return this.catalog.updateBrand(id, input);
  }

  @Delete(':id')
  @RequirePermissions('products.write')
  @HttpCode(204)
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.deleteBrand(id);
  }
}

@Controller('api/v1/categories')
@RequirePermissions('products.read')
export class CategoriesController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(@Query() query: ListQueryDto) {
    return this.catalog.listCategories(query);
  }

  @Patch('reorder')
  @RequirePermissions('categories.write')
  reorder(@Body() input: ReorderCategoriesDto) {
    return this.catalog.reorderCategories(input);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.getCategory(id);
  }

  @Post()
  @RequirePermissions('categories.write')
  create(@Body() input: CreateCategoryDto) {
    return this.catalog.createCategory(input);
  }

  @Patch(':id')
  @RequirePermissions('categories.write')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateCategoryDto,
  ) {
    return this.catalog.updateCategory(id, input);
  }

  @Delete(':id')
  @RequirePermissions('categories.write')
  @HttpCode(204)
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.deleteCategory(id);
  }
}

@Controller('api/v1/attributes')
@RequirePermissions('products.read')
export class AttributesController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(@Query() query: ListQueryDto) {
    return this.catalog.listAttributes(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.getAttribute(id);
  }

  @Post()
  @RequirePermissions('attributes.write')
  create(@Body() input: CreateAttributeDto) {
    return this.catalog.createAttribute(input);
  }

  @Patch(':id')
  @RequirePermissions('attributes.write')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateAttributeDto,
  ) {
    return this.catalog.updateAttribute(id, input);
  }

  @Delete(':id')
  @RequirePermissions('attributes.write')
  @HttpCode(204)
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.deleteAttribute(id);
  }

  @Get(':id/values')
  values(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.listAttributeValues(id);
  }

  @Post(':id/values')
  @RequirePermissions('attributes.write')
  createValue(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CreateAttributeValueDto,
  ) {
    return this.catalog.createAttributeValue(id, input);
  }
}

@Controller('api/v1/attribute-values')
@RequirePermissions('products.read')
export class AttributeValuesController {
  constructor(private readonly catalog: CatalogService) {}

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.getAttributeValue(id);
  }

  @Patch(':id')
  @RequirePermissions('attributes.write')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateAttributeValueDto,
  ) {
    return this.catalog.updateAttributeValue(id, input);
  }

  @Delete(':id')
  @RequirePermissions('attributes.write')
  @HttpCode(204)
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.deleteAttributeValue(id);
  }
}

@Controller('api/v1/products')
@RequirePermissions('products.read')
export class ProductsController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(@Query() query: ProductListQueryDto) {
    return this.catalog.listProducts(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.getProduct(id);
  }

  @Post()
  @RequirePermissions('products.write')
  create(@Body() input: CreateProductDto) {
    return this.catalog.createProduct(input);
  }

  @Patch(':id')
  @RequirePermissions('products.write')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateProductDto,
  ) {
    return this.catalog.updateProduct(id, input);
  }

  @Patch(':id/status')
  @RequirePermissions('products.write')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateProductStatusDto,
  ) {
    return this.catalog.updateProduct(id, { status: input.status });
  }

  @Delete(':id')
  @RequirePermissions('products.write')
  @HttpCode(204)
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.deleteProduct(id);
  }
}
