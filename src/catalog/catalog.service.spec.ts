import { BadRequestException } from '@nestjs/common';
import { FakeCatalogRepository } from '../../test/support/fake-repositories';
import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  let repository: FakeCatalogRepository;
  let service: CatalogService;

  beforeEach(() => {
    repository = new FakeCatalogRepository();
    service = new CatalogService(repository);
  });

  it('requires a swatch for color values', async () => {
    const attribute = await service.createAttribute({
      code: 'couleur',
      label: 'Couleur',
      type: 'color',
    });
    await expect(
      service.createAttributeValue(attribute.id, { label: 'Noir' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects multiple values for a non-multiselect attribute', async () => {
    const brand = await service.createBrand({ name: 'Casio' });
    const attribute = await service.createAttribute({
      code: 'mouvement',
      label: 'Mouvement',
      type: 'select',
    });
    const automatic = await service.createAttributeValue(attribute.id, {
      label: 'Automatique',
    });
    const quartz = await service.createAttributeValue(attribute.id, {
      label: 'Quartz',
    });

    await expect(
      service.createProduct({
        name: 'Test Watch',
        brandId: brand.id,
        reference: 'TEST-001',
        description: 'Test',
        price: 125000,
        seo: { slug: 'test-watch' },
        categoryIds: [],
        images: [],
        attributes: [
          {
            attributeId: attribute.id,
            valueIds: [automatic.id, quartz.id],
          },
        ],
      }),
    ).rejects.toThrow('accepts exactly one value');
  });

  it('accepts several values for a multiselect attribute', async () => {
    const brand = await service.createBrand({ name: 'Seiko' });
    const attribute = await service.createAttribute({
      code: 'fonctions',
      label: 'Fonctions',
      type: 'multiselect',
    });
    const date = await service.createAttributeValue(attribute.id, {
      label: 'Date',
    });
    const chrono = await service.createAttributeValue(attribute.id, {
      label: 'Chronographe',
    });
    const product = await service.createProduct({
      name: 'Seiko Multi',
      brandId: brand.id,
      reference: 'SEIKO-MULTI',
      description: 'Test',
      price: 300000,
      seo: { slug: 'seiko-multi' },
      categoryIds: [],
      images: [],
      attributes: [
        { attributeId: attribute.id, valueIds: [date.id, chrono.id] },
      ],
    });
    expect(product.price).toBe(300000);
    expect(product.finalPrice).toBe(300000);
    expect(product.available).toBe(false);
  });

  it('validates promotion prices and dates', async () => {
    const brand = await service.createBrand({ name: 'Tissot' });
    await expect(
      service.createProduct({
        name: 'Invalid promotion',
        brandId: brand.id,
        reference: 'PROMO-INVALID',
        description: 'Test',
        price: 450000,
        oldPrice: 400000,
        stock: 1,
        promotion: {
          active: true,
          endsAt: '2099-12-31T23:59:59.000Z',
        },
        categoryIds: [],
        images: [],
        attributes: [],
      }),
    ).rejects.toThrow('requires an oldPrice greater than price');
  });
});
