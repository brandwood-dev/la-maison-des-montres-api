import request from 'supertest';

const baseUrl = process.env.DEV_API_URL ?? 'http://127.0.0.1:3000';
const email = process.env.DEV_SEED_SUPER_ADMIN_EMAIL;
const password = process.env.DEV_SEED_SUPER_ADMIN_PASSWORD;

if (!email || !password) {
  throw new Error('Development seed credentials are required');
}

const agent = request.agent(baseUrl);
const suffix = Date.now().toString(36);
const ids: {
  brand?: string;
  category?: string;
  attribute?: string;
  value?: string;
  product?: string;
} = {};

function body<T>(response: request.Response): T {
  return response.body as T;
}

async function cleanup(): Promise<void> {
  if (ids.product) await agent.delete(`/api/v1/products/${ids.product}`);
  if (ids.value) await agent.delete(`/api/v1/attribute-values/${ids.value}`);
  if (ids.attribute) await agent.delete(`/api/v1/attributes/${ids.attribute}`);
  if (ids.category) await agent.delete(`/api/v1/categories/${ids.category}`);
  if (ids.brand) await agent.delete(`/api/v1/brands/${ids.brand}`);
}

async function smoke(): Promise<void> {
  await request(baseUrl).get('/health').expect(200);
  await request(baseUrl).get('/api/v1/brands').expect(401);

  await agent.post('/api/v1/auth/login').send({ email, password }).expect(200);
  await agent
    .get('/api/v1/auth/me')
    .expect(200)
    .expect((response) => {
      if (
        body<{ user?: { role?: string } }>(response).user?.role !==
        'super_admin'
      ) {
        throw new Error('Unexpected development admin role');
      }
    });

  const brand = await agent
    .post('/api/v1/brands')
    .send({ name: `Smoke Brand ${suffix}` })
    .expect(201);
  ids.brand = body<{ id: string }>(brand).id;

  const category = await agent
    .post('/api/v1/categories')
    .send({
      name: `Smoke Homme ${suffix}`,
      slug: `homme-${suffix}`,
    })
    .expect(201);
  ids.category = body<{ id: string }>(category).id;

  const attribute = await agent
    .post('/api/v1/attributes')
    .send({
      code: `couleur_${suffix}`,
      label: `Couleur ${suffix}`,
      type: 'color',
      visibleInFilters: true,
    })
    .expect(201);
  ids.attribute = body<{ id: string }>(attribute).id;

  const value = await agent
    .post(`/api/v1/attributes/${ids.attribute}/values`)
    .send({ label: `Noir ${suffix}`, swatch: '#000000' })
    .expect(201);
  ids.value = body<{ id: string }>(value).id;

  const product = await agent
    .post('/api/v1/products')
    .send({
      name: `Smoke Watch ${suffix}`,
      brandId: ids.brand,
      reference: `SMOKE-${suffix}`,
      description: 'Produit temporaire de validation locale',
      price: 450000,
      oldPrice: 610000,
      stock: 2,
      promotion: {
        active: true,
        endsAt: '2099-12-31T23:59:59.000Z',
      },
      status: 'draft',
      seo: { slug: `smoke-watch-${suffix}` },
      categoryIds: [ids.category],
      attributes: [{ attributeId: ids.attribute, valueIds: [ids.value] }],
      images: [
        {
          url: 'https://example.test/smoke-watch.jpg',
          alt: 'Smoke watch',
        },
      ],
    })
    .expect(201);
  ids.product = body<{ id: string }>(product).id;

  await agent
    .get(`/api/v1/products/${ids.product}`)
    .expect(200)
    .expect((response) => {
      const productBody = body<{
        brand?: string;
        stock?: number;
        promotion?: { effective?: boolean };
      }>(response);
      if (
        productBody.brand !== `Smoke Brand ${suffix}` ||
        productBody.stock !== 2 ||
        productBody.promotion?.effective !== true
      ) {
        throw new Error('Admin product response is not aligned');
      }
    });

  await request(baseUrl)
    .get(`/api/v1/public/products/smoke-watch-${suffix}`)
    .expect(404);
  await agent
    .patch(`/api/v1/products/${ids.product}/status`)
    .send({ status: 'published' })
    .expect(200);
  await request(baseUrl)
    .get(`/api/v1/public/products/smoke-watch-${suffix}`)
    .expect(200)
    .expect((response) => {
      const productBody = body<{
        currency?: string;
        promotion?: { salePriceMillimes?: number };
        availability?: string;
      }>(response);
      if (
        productBody.currency !== 'TND' ||
        productBody.promotion?.salePriceMillimes !== 450000 ||
        productBody.availability !== 'available'
      ) {
        throw new Error('Public product response is not aligned');
      }
    });

  await cleanup();
  await agent.post('/api/v1/auth/logout').expect(204);
  await agent.get('/api/v1/auth/me').expect(401);
}

smoke()
  .then(() => {
    console.log('Development database smoke test passed');
  })
  .catch(async (error: unknown) => {
    await cleanup().catch(() => undefined);
    console.error(error instanceof Error ? error.message : 'Smoke test failed');
    process.exitCode = 1;
  });
