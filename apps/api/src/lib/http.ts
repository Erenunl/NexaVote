import type { MiddlewareHandler } from 'hono';
import type { Bindings, AppVariables } from '../types';

type AppEnv = { Bindings: Bindings; Variables: AppVariables };

export function corsMiddleware(): MiddlewareHandler<AppEnv> {
  return async (context, next) => {
    const origin = context.req.header('Origin');
    const allowed = (context.env.ALLOWED_ORIGINS || '').split(',').map((item) => item.trim()).filter(Boolean);
    if (origin && allowed.includes(origin)) {
      context.header('Access-Control-Allow-Origin', origin);
      context.header('Vary', 'Origin');
      context.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Nexavision-Key-Id, X-Nexavision-Timestamp, X-Nexavision-Nonce, X-Nexavision-Signature');
      context.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      context.header('Access-Control-Max-Age', '86400');
    }
    if (context.req.method === 'OPTIONS') return context.body(null, 204);
    await next();
  };
}

export function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

export function isoAfterMinutes(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

export function publicError(message: string, code: string, status: 400 | 401 | 403 | 404 | 409 | 429 = 400) {
  return { message, code, status } as const;
}

