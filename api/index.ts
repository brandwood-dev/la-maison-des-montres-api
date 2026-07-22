import type { IncomingMessage, ServerResponse } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { createApp } from '../src/create-app';

type NodeHandler = (request: IncomingMessage, response: ServerResponse) => void;

let appPromise: Promise<INestApplication> | undefined;

async function getHandler(): Promise<NodeHandler> {
  appPromise ??= createApp().then(async (app) => {
    await app.init();
    return app;
  });

  const app = await appPromise;
  return app.getHttpAdapter().getInstance() as NodeHandler;
}

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const path = url.searchParams.get('__path');

  if (path !== null) {
    url.searchParams.delete('__path');
    const query = url.searchParams.toString();
    request.url = `/${path}${query ? `?${query}` : ''}`;
  }

  const nestHandler = await getHandler();
  nestHandler(request, response);
}
