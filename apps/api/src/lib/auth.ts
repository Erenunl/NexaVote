import type { MiddlewareHandler } from 'hono';
import type { Bindings, AppVariables, JurySession } from '../types';
import { bearerToken } from './http';
import { hmacSha256, sha256, timingSafeEqual } from './crypto';

type AppEnv = { Bindings: Bindings; Variables: AppVariables };

export const requireJury: MiddlewareHandler<AppEnv> = async (context, next) => {
  const token = bearerToken(context.req.header('Authorization'));
  if (!token) return context.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } }, 401);
  const tokenHash = await sha256(token);
  const row = await context.env.DB.prepare(`
    SELECT s.id AS sessionId, s.edition_id AS editionId, s.country_id AS countryId,
           s.credential_version AS credentialVersion, c.name AS countryName, c.code AS countryCode,
           c.flag_emoji AS flagEmoji
    FROM jury_sessions s
    JOIN active_jury_sessions active ON active.session_id = s.id
    JOIN countries c ON c.id = s.country_id
    JOIN jury_credentials jc ON jc.edition_id = s.edition_id AND jc.country_id = s.country_id
    WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?
      AND s.credential_version = jc.version
  `).bind(tokenHash, new Date().toISOString()).first<JurySession>();
  if (!row) return context.json({ error: { code: 'UNAUTHORIZED', message: 'Your session is invalid or expired.' } }, 401);
  context.set('jury', row);
  await next();
};

export const requireAdmin: MiddlewareHandler<AppEnv> = async (context, next) => {
  const token = bearerToken(context.req.header('Authorization'));
  if (!token) return context.json({ error: { code: 'UNAUTHORIZED', message: 'Administrator authentication required.' } }, 401);
  const tokenHash = await sha256(token);
  const row = await context.env.DB.prepare(
    'SELECT id FROM admin_sessions WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?'
  ).bind(tokenHash, new Date().toISOString()).first<{ id: string }>();
  if (!row) return context.json({ error: { code: 'UNAUTHORIZED', message: 'Administrator session is invalid or expired.' } }, 401);
  context.set('adminSessionId', row.id);
  await next();
};

export const requireIntegration: MiddlewareHandler<AppEnv> = async (context, next) => {
  const keyId = context.req.header('X-Nexavision-Key-Id') ?? '';
  const timestamp = context.req.header('X-Nexavision-Timestamp') ?? '';
  const nonce = context.req.header('X-Nexavision-Nonce') ?? '';
  const signature = context.req.header('X-Nexavision-Signature') ?? '';
  if (!keyId || !timestamp || !nonce || !signature || keyId !== context.env.BOT_API_KEY_ID) {
    return context.json({ error: { code: 'UNAUTHORIZED', message: 'Valid integration authentication is required.' } }, 401);
  }
  const timestampMs = Date.parse(timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60_000) {
    return context.json({ error: { code: 'STALE_REQUEST', message: 'The integration request timestamp is outside the allowed window.' } }, 401);
  }
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(nonce)) {
    return context.json({ error: { code: 'INVALID_NONCE', message: 'The integration request nonce is invalid.' } }, 401);
  }
  const body = await context.req.raw.clone().arrayBuffer();
  const bodyHash = await sha256(body);
  const payload = `${context.req.method.toUpperCase()}\n${new URL(context.req.url).pathname}\n${timestamp}\n${nonce}\n${bodyHash}`;
  const expected = await hmacSha256(context.env.BOT_API_SECRET, payload);
  if (!timingSafeEqual(expected, signature)) {
    return context.json({ error: { code: 'UNAUTHORIZED', message: 'Valid integration authentication is required.' } }, 401);
  }
  try {
    await context.env.DB.prepare('INSERT INTO integration_nonces (nonce, key_id, expires_at) VALUES (?, ?, ?)')
      .bind(nonce, keyId, new Date(Date.now() + 10 * 60_000).toISOString()).run();
  } catch {
    return context.json({ error: { code: 'REPLAY_DETECTED', message: 'This integration request has already been used.' } }, 409);
  }
  context.set('integrationKeyId', keyId);
  await next();
};

export async function audit(
  db: D1Database,
  actorType: 'admin' | 'integration' | 'jury' | 'system',
  actorId: string | null,
  action: string,
  targetType: string | null = null,
  targetId: string | null = null,
  editionId: string | null = null,
  metadata: Record<string, unknown> = {},
) {
  await db.prepare(`INSERT INTO audit_logs
    (id, edition_id, actor_type, actor_id, action, target_type, target_id, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), editionId, actorType, actorId, action, targetType, targetId, JSON.stringify(metadata)).run();
}

export async function isRateLimited(db: D1Database, scope: string, identifier: string, limit = 5): Promise<boolean> {
  const key = await sha256(identifier);
  const now = Date.now();
  const row = await db.prepare('SELECT attempts, window_started_at AS windowStartedAt, blocked_until AS blockedUntil FROM login_attempts WHERE scope = ? AND identifier_hash = ?')
    .bind(scope, key).first<{ attempts: number; windowStartedAt: string; blockedUntil: string | null }>();
  if (row?.blockedUntil && Date.parse(row.blockedUntil) > now) return true;
  if (!row || now - Date.parse(row.windowStartedAt) > 15 * 60_000) {
    await db.prepare(`INSERT INTO login_attempts (scope, identifier_hash, window_started_at, attempts, blocked_until)
      VALUES (?, ?, ?, 1, NULL)
      ON CONFLICT(scope, identifier_hash) DO UPDATE SET window_started_at = excluded.window_started_at, attempts = 1, blocked_until = NULL`)
      .bind(scope, key, new Date(now).toISOString()).run();
    return false;
  }
  const attempts = row.attempts + 1;
  const blockedUntil = attempts >= limit ? new Date(now + 15 * 60_000).toISOString() : null;
  await db.prepare('UPDATE login_attempts SET attempts = ?, blocked_until = ? WHERE scope = ? AND identifier_hash = ?')
    .bind(attempts, blockedUntil, scope, key).run();
  return attempts > limit;
}

export async function clearRateLimit(db: D1Database, scope: string, identifier: string) {
  await db.prepare('DELETE FROM login_attempts WHERE scope = ? AND identifier_hash = ?').bind(scope, await sha256(identifier)).run();
}

