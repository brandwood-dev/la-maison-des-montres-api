import { createServer, Server } from 'node:http';
import request from 'supertest';
import handler, {
  closeServerlessAppForTests,
  rewriteVercelRequest,
  type VercelRequest,
} from '../api/index';

describe('Vercel serverless entrypoint (e2e)', () => {
  let server: Server;

  beforeAll(() => {
    server = createServer((incomingRequest, response) => {
      void handler(incomingRequest, response);
    });
  });

  it('serves GET /api/health after the Vercel rewrite', async () => {
    await request(server)
      .get('/api?__path=health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('preserves the external /api/v1 prefix for admin routes', async () => {
    await request(server).get('/api?__path=v1/auth/me').expect(401);
  });

  it('removes Vercel routing parameters before validating query DTOs', () => {
    const incoming = {
      url: '/api?__path=v1/public/products&path=v1/public/products&page=1',
      query: {
        __path: 'v1/public/products',
        path: 'v1/public/products',
        page: '1',
      },
    } as unknown as VercelRequest;

    rewriteVercelRequest(incoming);

    expect(incoming.url).toBe('/api/v1/public/products?page=1');
    expect(incoming.query).toEqual({ page: '1' });
  });

  afterAll(async () => {
    if (server.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    await closeServerlessAppForTests();
  });
});
