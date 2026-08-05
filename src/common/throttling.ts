import type { ThrottlerGetTrackerFunction } from '@nestjs/throttler';

/**
 * Returns a stable client key when the API runs behind Cloudflare/Vercel.
 *
 * The default Nest throttler key uses the server-observed IP. Behind a proxy
 * that can collapse several users into one address, which may lock out the
 * admin login after a few unrelated attempts. We prefer the trusted proxy
 * headers and scope login attempts to the normalized e-mail as well. The
 * global per-IP limit remains active for every other endpoint.
 */
export const getThrottlerTracker: ThrottlerGetTrackerFunction = (request) => {
  const headers = request.headers as Record<
    string,
    string | string[] | undefined
  >;
  const header = (name: string): string | undefined => {
    const value = headers[name];
    if (Array.isArray(value)) return value[0]?.trim();
    return value?.split(',')[0]?.trim();
  };

  const requestIp = typeof request.ip === 'string' ? request.ip : undefined;
  const clientIp =
    header('cf-connecting-ip') ??
    header('x-real-ip') ??
    header('x-forwarded-for') ??
    requestIp ??
    'unknown-client';

  const body = request.body as { email?: unknown } | undefined;
  const email =
    typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

  return email ? `${clientIp}:login:${email}` : clientIp;
};
