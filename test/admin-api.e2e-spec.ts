import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AUTH_REPOSITORY } from '../src/auth/auth.constants';
import { AuthService } from '../src/auth/auth.service';
import { CATALOG_REPOSITORY } from '../src/catalog/catalog.constants';
import { configureApp } from '../src/configure-app';
import type { AdminUserRow } from '../src/database/schema';
import {
  FakeAuthRepository,
  FakeCatalogRepository,
} from './support/fake-repositories';

describe('Admin API V1 (integration)', () => {
  let app: INestApplication<App>;
  let adminAgent: ReturnType<typeof request.agent>;
  let readOnlyAgent: ReturnType<typeof request.agent>;
  const authRepository = new FakeAuthRepository();
  const catalogRepository = new FakeCatalogRepository();

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    authRepository.users.push(
      await user('admin@example.test', 'super_admin'),
      await user('reader@example.test', 'lecture_seule'),
    );
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AUTH_REPOSITORY)
      .useValue(authRepository)
      .overrideProvider(CATALOG_REPOSITORY)
      .useValue(catalogRepository)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app, []);
    await app.init();
    adminAgent = request.agent(app.getHttpServer());
    readOnlyAgent = request.agent(app.getHttpServer());
  });

  it('authenticates with HTTP-only cookies and exposes no token in JSON', async () => {
    const response = await adminAgent
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.test', password: 'Test-password-42' })
      .expect(200);

    const setCookie = response.headers['set-cookie'] as string | string[];
    expect(
      Array.isArray(setCookie) ? setCookie.join(';') : setCookie,
    ).toContain('HttpOnly');
    expect(response.body).not.toHaveProperty('accessToken');
    expect(response.body).not.toHaveProperty('refreshToken');
    await adminAgent.get('/api/v1/auth/me').expect(200);
  });

  it('creates and reads brands, categories, attributes and products', async () => {
    const brand = await adminAgent
      .post('/api/v1/brands')
      .send({ name: 'Casio' })
      .expect(201);
    const brandBody = brand.body as {
      id: string;
      order: number;
      seo: object;
      sortOrder?: number;
    };
    expect(brandBody.order).toBe(0);
    expect(brandBody.seo).toEqual({});
    expect(brandBody.sortOrder).toBeUndefined();
    const category = await adminAgent
      .post('/api/v1/categories')
      .send({ name: 'Montres homme' })
      .expect(201);
    const categoryBody = category.body as { id: string };
    await adminAgent
      .patch('/api/v1/categories/reorder')
      .send({ items: [{ id: categoryBody.id, order: 4 }] })
      .expect(200)
      .expect((response) => {
        const body = response.body as { order: number }[];
        expect(body[0]?.order).toBe(4);
      });
    const attribute = await adminAgent
      .post('/api/v1/attributes')
      .send({
        code: 'couleur',
        label: 'Couleur',
        type: 'color',
        visibleInFilters: true,
      })
      .expect(201);
    const attributeBody = attribute.body as {
      id: string;
      code: string;
      label: string;
      visibleInFilters: boolean;
      values: unknown[];
    };
    expect(attributeBody).toMatchObject({
      code: 'couleur',
      label: 'Couleur',
      visibleInFilters: true,
      values: [],
    });
    const value = await adminAgent
      .post(`/api/v1/attributes/${attributeBody.id}/values`)
      .send({ label: 'Noir', swatch: '#000000' })
      .expect(201);
    const valueBody = value.body as { id: string };

    const product = await adminAgent
      .post('/api/v1/products')
      .send({
        name: 'Casio Edifice',
        brandId: brandBody.id,
        reference: 'CAS-EDI-001',
        description: 'Montre de test',
        price: 349900,
        seo: { slug: 'casio-edifice' },
        categoryIds: [categoryBody.id],
        attributes: [
          { attributeId: attributeBody.id, valueIds: [valueBody.id] },
        ],
        images: [
          {
            url: 'https://cdn.example.test/watch.jpg',
            alt: 'Casio Edifice',
          },
        ],
      })
      .expect(201);
    const productBody = product.body as {
      id: string;
      price: number;
      finalPrice: number;
      stock: number;
      available: boolean;
      seo: { slug: string };
      images: { order: number }[];
    };

    expect(productBody.price).toBe(349900);
    expect(productBody.finalPrice).toBe(349900);
    expect(productBody.stock).toBe(0);
    expect(productBody.available).toBe(false);
    expect(productBody.seo.slug).toBe('casio-edifice');
    expect(productBody.images[0]?.order).toBe(0);

    await adminAgent
      .patch(`/api/v1/products/${productBody.id}/status`)
      .send({ status: 'published' })
      .expect(200)
      .expect((response) => {
        const body = response.body as { status: string };
        expect(body.status).toBe('published');
      });
    await adminAgent
      .patch(`/api/v1/products/${productBody.id}`)
      .send({
        stock: 3,
        oldPrice: 399900,
        promotion: {
          active: true,
          endsAt: '2099-12-31T23:59:59.000Z',
        },
      })
      .expect(200)
      .expect((response) => {
        const body = response.body as {
          brand: string;
          stock: number;
          available: boolean;
          promotion: { effective: boolean };
        };
        expect(body.brand).toBe('Casio');
        expect(body.stock).toBe(3);
        expect(body.available).toBe(true);
        expect(body.promotion.effective).toBe(true);
      });
    await adminAgent.get('/api/v1/brands').expect(200);
    await adminAgent.get('/api/v1/categories').expect(200);
    await adminAgent.get('/api/v1/attributes').expect(200);
    await adminAgent
      .get('/api/v1/products?status=published')
      .expect(200)
      .expect((response) => {
        const body = response.body as {
          total: number;
          totalPages?: number;
        };
        expect(body.total).toBe(1);
        expect(body.totalPages).toBeUndefined();
      });
    await request(app.getHttpServer())
      .get('/api/v1/public/products')
      .expect(200)
      .expect((response) => {
        const body = response.body as {
          total: number;
          data: {
            slug: string;
            brand: string;
            currency: string;
            regularPriceMillimes: number;
            promotion: { salePriceMillimes: number };
            availability: string;
          }[];
        };
        expect(body.total).toBe(1);
        expect(body.data[0]).toMatchObject({
          slug: 'casio-edifice',
          brand: 'Casio',
          currency: 'TND',
          regularPriceMillimes: 399900,
          promotion: { salePriceMillimes: 349900 },
          availability: 'available',
        });
      });
    await request(app.getHttpServer())
      .get(
        `/api/v1/public/products?categoryId=${categoryBody.id}&maxPrice=349899`,
      )
      .expect(200)
      .expect((response) => {
        expect((response.body as { total: number }).total).toBe(0);
      });
    await request(app.getHttpServer())
      .get('/api/v1/public/brands?pageSize=100')
      .expect(200)
      .expect((response) => {
        expect((response.body as { data: unknown[] }).data).toHaveLength(1);
      });
    await request(app.getHttpServer())
      .get('/api/v1/public/categories?pageSize=100')
      .expect(200)
      .expect((response) => {
        expect((response.body as { data: unknown[] }).data).toHaveLength(1);
      });
    await request(app.getHttpServer())
      .get('/api/v1/public/products/casio-edifice')
      .expect(200);
  });

  it('returns the contract error envelope for invalid DTOs', async () => {
    await adminAgent
      .post('/api/v1/brands')
      .send({ name: '', unexpected: true })
      .expect(400)
      .expect((response) => {
        const body = response.body as Record<string, unknown>;
        expect(body.code).toBe('VALIDATION_ERROR');
        expect(body.message).toBe('Request validation failed');
        const details = body.details as Record<string, unknown>;
        expect(Array.isArray(details.name)).toBe(true);
        expect(Array.isArray(details.unexpected)).toBe(true);
        expect(body.path).toBeUndefined();
        expect(body.timestamp).toBeUndefined();
      });
  });

  it('enforces server-side permissions for a read-only user', async () => {
    await readOnlyAgent
      .post('/api/v1/auth/login')
      .send({ email: 'reader@example.test', password: 'Test-password-42' })
      .expect(200);
    await readOnlyAgent.get('/api/v1/brands').expect(200);
    await readOnlyAgent
      .post('/api/v1/brands')
      .send({ name: 'Forbidden' })
      .expect(403);
  });

  afterAll(async () => {
    await app.close();
  });
});

async function user(
  email: string,
  role: AdminUserRow['role'],
): Promise<AdminUserRow> {
  const now = new Date();
  return {
    id: randomUUID(),
    email,
    passwordHash: await AuthService.hashPassword('Test-password-42'),
    firstName: 'Test',
    lastName: 'User',
    phone: null,
    avatarUrl: null,
    role,
    status: 'active',
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
  };
}
