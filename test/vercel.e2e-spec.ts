import { EventEmitter } from 'node:events';
import { createServer, Server, type ServerResponse } from 'node:http';
import request from 'supertest';
import handler, {
  closeServerlessAppForTests,
  rewriteVercelRequest,
  type VercelRequest,
  waitForResponseCompletion,
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

  it('releases the invocation when the client closes early', async () => {
    const response = new EventEmitter() as unknown as ServerResponse;
    const dispatch = jest.fn(() => response.emit('close'));

    await expect(waitForResponseCompletion(response, dispatch)).resolves.toBe(
      'closed',
    );
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('distinguishes a completed response from an aborted one', async () => {
    const response = new EventEmitter() as unknown as ServerResponse;
    const dispatch = jest.fn(() => response.emit('finish'));

    await expect(waitForResponseCompletion(response, dispatch)).resolves.toBe(
      'finished',
    );
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
