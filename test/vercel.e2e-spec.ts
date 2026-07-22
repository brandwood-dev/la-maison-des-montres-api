import { createServer, Server } from 'node:http';
import request from 'supertest';
import handler from '../api/index';

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

  afterAll(() => {
    server.close();
  });
});
