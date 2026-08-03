import { Module } from '@nestjs/common';
import { CATALOG_REPOSITORY } from './catalog.constants';
import {
  AttributesController,
  AttributeValuesController,
  BrandsController,
  CategoriesController,
  ProductsController,
  PublicProductsController,
  PublicBrandsController,
  PublicCategoriesController,
  PublicAttributesController,
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
    PublicBrandsController,
    PublicCategoriesController,
    PublicAttributesController,
  ],
  providers: [
    CatalogService,
    DrizzleCatalogRepository,
    { provide: CATALOG_REPOSITORY, useExisting: DrizzleCatalogRepository },
  ],
  exports: [CatalogService, CATALOG_REPOSITORY],
})
export class CatalogModule {}
