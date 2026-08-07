import type { IncomingMessage, ServerResponse } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { createApp } from '../src/create-app';

type NodeHandler = (request: IncomingMessage, response: ServerResponse) => void;
type ResponseDispatcher = () => void;
export type ResponseCompletion = 'finished' | 'closed';
export const SERVERLESS_REQUEST_TIMEOUT_MS = 10_000;
export type VercelRequest = IncomingMessage & {
  query?: Record<string, string | string[] | undefined>;
};

let appPromise: Promise<INestApplication> | undefined;
let appCleanupPromise: Promise<void> | undefined;

async function disposeApp(currentApp: Promise<INestApplication>): Promise<void> {
  try {
    const app = await currentApp;
    await app.close();
  } catch {
    // A timed-out request may already have torn down part of the app. The
    // next invocation must still be allowed to create a clean instance.
  }
}

function recycleServerlessApp(): void {
  const currentApp = appPromise;
  appPromise = undefined;
  if (!currentApp) return;

  // Do not make the 504 response wait for shutdown. Queue cleanup so only one
  // pool is closed at a time while the next request gets a fresh app/pool.
  appCleanupPromise = (appCleanupPromise ?? Promise.resolve()).then(() =>
    disposeApp(currentApp),
  );
}

export async function closeServerlessAppForTests(): Promise<void> {
  const currentApp = appPromise;
  appPromise = undefined;
  if (currentApp) {
    appCleanupPromise = (appCleanupPromise ?? Promise.resolve()).then(() =>
      disposeApp(currentApp),
    );
  }
  await appCleanupPromise;
}

async function getHandler(): Promise<NodeHandler> {
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
  request?: IncomingMessage,
  timeoutMs = SERVERLESS_REQUEST_TIMEOUT_MS,
): Promise<ResponseCompletion> {
  return new Promise<ResponseCompletion>((resolve, reject) => {
    const originalEnd = response.end.bind(response);
    let settled = false;
    let endCalled = false;
    const cleanup = () => {
      response.off('finish', finish);
      response.off('close', close);
      response.off('error', fail);
      request?.off('aborted', aborted);
      clearTimeout(timeout);
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
    const aborted = () => complete('closed');
    const timeout = setTimeout(() => complete('closed'), timeoutMs);

    response.once('finish', finish);
    response.once('close', close);
    response.once('error', fail);
    request?.once('aborted', aborted);
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
    const completion = await waitForResponseCompletion(
      response,
      () => nestHandler(request, response),
      request,
    );
    if (completion === 'closed' || requestAborted) {
      // Do not write to a disconnected response or after Nest has sent headers.
      if (!requestAborted && !response.destroyed && !response.writableEnded) {
        if (response.headersSent) {
          response.end();
          recycleServerlessApp();
          return;
        }
        response.statusCode = 504;
        response.setHeader('cache-control', 'no-store');
        response.setHeader('content-type', 'application/json; charset=utf-8');
        response.end(
          JSON.stringify({
            code: 'SERVERLESS_REQUEST_TIMEOUT',
            message: 'La requête API a dépassé le délai autorisé.',
          }),
        );
      }
      recycleServerlessApp();
    }
  } finally {
    request.off('aborted', onRequestAborted);
  }
}
