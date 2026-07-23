import { createServer, Server } from 'node:http';
import request from 'supertest';
import handler, { closeServerlessAppForTests } from '../api/index';

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

  afterAll(async () => {
    if (server.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    await closeServerlessAppForTests();
  });
});
