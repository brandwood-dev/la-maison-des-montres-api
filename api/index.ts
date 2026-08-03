import type { IncomingMessage, ServerResponse } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { createApp } from '../src/create-app';

type NodeHandler = (request: IncomingMessage, response: ServerResponse) => void;
type ResponseDispatcher = () => void;
export type ResponseCompletion = 'finished' | 'closed';
export type VercelRequest = IncomingMessage & {
  query?: Record<string, string | string[] | undefined>;
};

let appPromise: Promise<INestApplication> | undefined;
let abortedAppCleanup: Promise<void> | undefined;

export async function closeServerlessAppForTests(): Promise<void> {
  const currentApp = appPromise;
  appPromise = undefined;
  if (!currentApp) return;

  const app = await currentApp;
  await app.close();
}

async function resetServerlessAppAfterAbort(): Promise<void> {
  abortedAppCleanup ??= closeServerlessAppForTests()
    .catch(() => undefined)
    .finally(() => {
      abortedAppCleanup = undefined;
    });
  await abortedAppCleanup;
}

async function getHandler(): Promise<NodeHandler> {
  if (abortedAppCleanup) await abortedAppCleanup;
  appPromise ??= createApp().then(async (app) => {
    await app.init();
    return app;
  });

  const app = await appPromise;
  return app.getHttpAdapter().getInstance() as NodeHandler;
}

export function waitForResponseCompletion(
  response: ServerResponse,
  dispatch: ResponseDispatcher,
): Promise<ResponseCompletion> {
  return new Promise<ResponseCompletion>((resolve, reject) => {
    const originalEnd = response.end.bind(response);
    let settled = false;
    let endCalled = false;
    const cleanup = () => {
      response.off('finish', finish);
      response.off('close', close);
      response.off('error', fail);
      response.end = originalEnd;
    };
    const complete = (completion: ResponseCompletion) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(completion);
    };
    const finish = () => complete('finished');
    const close = () => complete(endCalled ? 'finished' : 'closed');
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    response.once('finish', finish);
    response.once('close', close);
    response.once('error', fail);
    response.end = ((...args: unknown[]) => {
      endCalled = true;
      const result = Reflect.apply(
        originalEnd,
        response,
        args,
      ) as ServerResponse;
      complete('finished');
      return result;
    }) as typeof response.end;

    try {
      dispatch();
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)));
    }
  });
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
  let requestAborted = false;
  const onRequestAborted = () => {
    requestAborted = true;
  };
  request.once('aborted', onRequestAborted);
  rewriteVercelRequest(request);
  try {
    const nestHandler = await getHandler();
    const completion = await waitForResponseCompletion(response, () =>
      nestHandler(request, response),
    );
    if (completion === 'closed' || requestAborted) {
      await resetServerlessAppAfterAbort();
    }
  } finally {
    request.off('aborted', onRequestAborted);
  }
}
