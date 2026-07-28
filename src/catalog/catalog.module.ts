import { Module } from '@nestjs/common';
import { CATALOG_REPOSITORY } from './catalog.constants';
import {
  AttributesController,
  AttributeValuesController,
  BrandsController,
  CategoriesController,
  ProductsController,
  PublicProductsController,
} from './catalog.controllers';
import { DrizzleCatalogRepository } from './catalog.repository';
import { CatalogService } from './catalog.service';

@Module({
  controllers: [
    BrandsController,
    CategoriesController,
    AttributesController,
    AttributeValuesController,
    ProductsController,
    PublicProductsController,
  ],
  providers: [
    CatalogService,
    DrizzleCatalogRepository,
    { provide: CATALOG_REPOSITORY, useExisting: DrizzleCatalogRepository },
  ],
  exports: [CatalogService, CATALOG_REPOSITORY],
})
export class CatalogModule {}
