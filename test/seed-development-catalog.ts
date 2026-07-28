import request from 'supertest';

const baseUrl = process.env.DEV_API_URL ?? 'http://127.0.0.1:3001';
const email = process.env.DEV_SEED_SUPER_ADMIN_EMAIL;
const password = process.env.DEV_SEED_SUPER_ADMIN_PASSWORD;

if (!email || !password) {
  throw new Error('Development seed credentials are required');
}

type Page<T> = { data: T[] };
type Resource = { id: string; name: string };
type Product = { id: string; reference: string; status: string };

const agent = request.agent(baseUrl);

async function ensureBrand(name: string): Promise<string> {
  const list = await agent.get('/api/v1/brands?pageSize=100').expect(200);
  const existing = (list.body as Page<Resource>).data.find(
    (item) => item.name.toLowerCase() === name.toLowerCase(),
  );
  if (existing) return existing.id;
  const created = await agent.post('/api/v1/brands').send({ name }).expect(201);
  return (created.body as Resource).id;
}

async function ensureCategory(name: string, slug: string): Promise<string> {
  const list = await agent.get('/api/v1/categories?pageSize=100').expect(200);
  const existing = (list.body as Page<Resource & { slug: string }>).data.find(
    (item) => item.slug === slug,
  );
  if (existing) return existing.id;
  const created = await agent
    .post('/api/v1/categories')
    .send({ name, slug, active: true })
    .expect(201);
  return (created.body as Resource).id;
}

async function ensureProduct(input: {
  name: string;
  reference: string;
  brandId: string;
  categoryId: string;
  price: number;
  slug: string;
  description: string;
  status: 'draft' | 'published';
  images: { url: string; alt: string; order: number }[];
}): Promise<Product> {
  const list = await agent.get('/api/v1/products?pageSize=100').expect(200);
  const existing = (list.body as Page<Product>).data.find(
    (item) => item.reference.toLowerCase() === input.reference.toLowerCase(),
  );
  const payload = {
    name: input.name,
    reference: input.reference,
    brandId: input.brandId,
    description: input.description,
    price: input.price,
    oldPrice: null,
    stock: 5,
    promotion: { active: false },
    status: input.status,
    seo: { slug: input.slug },
    categoryIds: [input.categoryId],
    attributes: [],
    images: input.images,
  };
  const response = existing
    ? await agent
        .patch(`/api/v1/products/${existing.id}`)
        .send(payload)
        .expect(200)
    : await agent.post('/api/v1/products').send(payload).expect(201);
  return response.body as Product;
}

async function main(): Promise<void> {
  await request(baseUrl).get('/health').expect(200);
  await request(baseUrl).post('/api/v1/products').send({}).expect(401);
  await agent.post('/api/v1/auth/login').send({ email, password }).expect(200);
  await agent.get('/api/v1/auth/me').expect(200);

  const calvinKlein = await ensureBrand('Calvin Klein');
  const tissot = await ensureBrand('Tissot');
  const swatch = await ensureBrand('Swatch');
  const women = await ensureCategory('Montres Femme', 'femme');
  const men = await ensureCategory('Montres Homme', 'homme');
  const children = await ensureCategory('Montres Enfant', 'enfant');

  const published = [
    await ensureProduct({
      name: 'Calvin Klein Forme',
      reference: '25100188',
      brandId: calvinKlein,
      categoryId: women,
      price: 610_000,
      slug: 'calvin-klein-forme-25100188',
      description:
        'Montre femme au cadran vert profond et bracelet acier bicolore.',
      status: 'published',
      images: [
        {
          url: 'https://res.cloudinary.com/dxkxiy900/image/upload/v1784405583/forme_yiggo6.jpg',
          alt: 'Montre Calvin Klein Forme 25100188',
          order: 0,
        },
        {
          url: 'https://res.cloudinary.com/dxkxiy900/image/upload/v1784405773/forme_1_kdo6ll.jpg',
          alt: 'Calvin Klein Forme 25100188 vue de profil',
          order: 1,
        },
      ],
    }),
    await ensureProduct({
      name: 'Tissot Classic Dream Automatic 40 mm',
      reference: 'T158.407.11.051.00',
      brandId: tissot,
      categoryId: men,
      price: 1_879_000,
      slug: 'tissot-classic-dream-automatic-40mm',
      description:
        'Montre automatique suisse au cadran noir et bracelet acier.',
      status: 'published',
      images: [
        {
          url: 'https://res.cloudinary.com/dxkxiy900/image/upload/v1784406097/tissot-classic-dream-automatic-40mm_svizoi.jpg',
          alt: 'Tissot Classic Dream Automatic 40 mm',
          order: 0,
        },
      ],
    }),
  ];

  const draft = await ensureProduct({
    name: 'Swatch The Gold Within You',
    reference: 'LE108',
    brandId: swatch,
    categoryId: children,
    price: 250_000,
    slug: 'swatch-the-gold-within-you-le108',
    description: 'Montre enfant colorée avec boîtier transparent.',
    status: 'draft',
    images: [
      {
        url: 'https://res.cloudinary.com/dxkxiy900/image/upload/v1784406756/the-gold-within-you_sooqcf.jpg',
        alt: 'Swatch The Gold Within You LE108',
        order: 0,
      },
    ],
  });

  const publicList = await request(baseUrl)
    .get('/api/v1/public/products?pageSize=100')
    .expect(200);
  const publicProducts = (publicList.body as Page<Product>).data;
  if (publicProducts.some((product) => product.id === draft.id)) {
    throw new Error('Draft product leaked into the public catalogue');
  }
  for (const product of published) {
    if (!publicProducts.some((item) => item.id === product.id)) {
      throw new Error('Published product missing from public catalogue');
    }
  }
  await request(baseUrl)
    .get('/api/v1/public/products/unknown-catalog-product')
    .expect(404);
  await agent.post('/api/v1/auth/logout').expect(204);
  await agent.get('/api/v1/auth/me').expect(401);

  console.log(
    `Development catalogue ready: ${published.length} published, 1 draft`,
  );
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
