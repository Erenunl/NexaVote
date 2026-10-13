import { Hono } from 'hono';
import type { Bindings, AppVariables } from './types';
import { corsMiddleware } from './lib/http';
import { publicRoutes } from './routes/public';
import { juryRoutes } from './routes/jury';
import { adminRoutes } from './routes/admin';
import { integrationRoutes } from './routes/integration';

type AppEnv = { Bindings: Bindings; Variables: AppVariables };
const app = new Hono<AppEnv>();

app.use('*', corsMiddleware());
app.use('*', async (context, next) => {
  context.header('X-Content-Type-Options', 'nosniff');
  context.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  context.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  context.header('Cache-Control', 'no-store');
  await next();
});

app.get('/api/health', (context) => context.json({ status: 'ok', service: 'nexavision-api' }));
app.route('/api/public', publicRoutes);
app.route('/api/jury', juryRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/integration/v1', integrationRoutes);

app.notFound((context) => context.json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } }, 404));
app.onError((error, context) => {
  console.error('Unhandled request error', error instanceof Error ? error.message : 'unknown');
  return context.json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } }, 500);
});

export default app;

