import type { IncomingMessage, ServerResponse } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { createApp } from '../src/create-app';

type NodeHandler = (request: IncomingMessage, response: ServerResponse) => void;
export type VercelRequest = IncomingMessage & {
  query?: Record<string, string | string[] | undefined>;
};

let appPromise: Promise<INestApplication> | undefined;

export async function closeServerlessAppForTests(): Promise<void> {
  if (appPromise) {
    const app = await appPromise;
    await app.close();
    appPromise = undefined;
  }
}

async function getHandler(): Promise<NodeHandler> {
  appPromise ??= createApp().then(async (app) => {
    await app.init();
    return app;
  });

  const app = await appPromise;
  return app.getHttpAdapter().getInstance() as NodeHandler;
}

export function rewriteVercelRequest(request: VercelRequest): void {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const path = url.searchParams.get('__path');

  if (path === null) return;

  url.searchParams.delete('__path');
  url.searchParams.delete('path');
  if (request.query) {
    delete request.query.__path;
    delete request.query.path;
  }
  const query = url.searchParams.toString();
  const internalPath = path === 'health' ? '/health' : `/api/${path}`;
  request.url = `${internalPath}${query ? `?${query}` : ''}`;
}

export default async function handler(
  request: VercelRequest,
  response: ServerResponse,
): Promise<void> {
  rewriteVercelRequest(request);
  const nestHandler = await getHandler();
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      response.off('finish', finish);
      response.off('close', finish);
      response.off('error', fail);
    };
    const finish = () => {
      cleanup();
      resolve();
    };
    const fail = (error: Error) => {
      cleanup();
      reject(error);
    };

    response.once('finish', finish);
    response.once('close', finish);
    response.once('error', fail);

    try {
      nestHandler(request, response);
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
