import { ConfigService } from '@nestjs/config';
import { FakeCatalogRepository } from '../../test/support/fake-repositories';
import { CatalogService } from '../catalog/catalog.service';
import { MetaFeedService } from './meta-feed.service';

describe('MetaFeedService', () => {
  it('includes published products and excludes drafts with valid Meta fields', async () => {
    const repository = new FakeCatalogRepository();
    const catalog = new CatalogService(repository);
    const brand = await catalog.createBrand({ name: 'Maison & Co' });
    const now = new Date('2026-08-05T12:00:00.000Z');

    await catalog.createProduct({
      name: 'Chrono, Édition "Or"',
      brandId: brand.id,
      reference: 'META-001',
      description: 'Une montre, élégante et durable.',
      price: 129900,
      oldPrice: 149900,
      stock: 2,
      status: 'published',
      isBestSeller: true,
      isFeatured: true,
      promotion: {
        active: true,
        startsAt: '2026-08-05T00:00:00.000Z',
        endsAt: '2026-08-10T00:00:00.000Z',
      },
      seo: { slug: 'chrono-edition-or' },
      categoryIds: [],
      attributes: [],
      images: [
        { url: 'https://cdn.example.com/chrono-main.jpg', order: 0 },
        { url: 'https://cdn.example.com/chrono-back.jpg', order: 1 },
        { url: 'http://cdn.example.com/not-https.jpg', order: 2 },
      ],
    });
    const published = repository.products[0];
    published.enrichment = {
      brand: repository.brands[0],
      categories: [],
      attributes: [],
      values: [],
    };

    await catalog.createProduct({
      name: 'Brouillon non exporté',
      brandId: brand.id,
      reference: 'META-DRAFT',
      description: 'Ne doit jamais apparaître dans le flux.',
      price: 100000,
      status: 'draft',
      categoryIds: [],
      attributes: [],
      images: [],
    });

    await catalog.createProduct({
      name: 'Rupture publiée',
      brandId: brand.id,
      reference: 'META-OUT',
      description: 'Produit publié mais sans stock.',
      price: 75000,
      stock: 0,
      status: 'published',
      categoryIds: [],
      attributes: [],
      images: [],
    });

    const feed = new MetaFeedService(
      repository,
      new ConfigService({ PUBLIC_SITE_URL: 'https://lamaisondesmontres.com' }),
    );
    const csv = await feed.generateCsv(now);

    expect(csv).toContain('id,title,description,availability,condition,price');
    expect(csv).toContain('Chrono, Édition');
    expect(csv).toContain('in stock');
    expect(csv).toContain('out of stock');
    expect(csv).toContain('129.900 TND');
    expect(csv).toContain('149.900 TND');
    expect(csv).toContain(
      'https://lamaisondesmontres.com/montres/chrono-edition-or',
    );
    expect(csv).toContain('https://cdn.example.com/chrono-main.jpg');
    expect(csv).toContain('https://cdn.example.com/chrono-back.jpg');
    expect(csv).not.toContain('http://cdn.example.com/not-https.jpg');
    expect(csv).not.toContain('Brouillon non exporté');
  });
});
