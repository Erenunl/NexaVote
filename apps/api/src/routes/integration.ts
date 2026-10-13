import { Hono } from 'hono';
import type { Bindings, AppVariables } from '../types';
import { requireIntegration, audit } from '../lib/auth';
import { generateJuryPassword, setJuryCredential } from '../lib/credentials';

type AppEnv = { Bindings: Bindings; Variables: AppVariables };
export const integrationRoutes = new Hono<AppEnv>();
integrationRoutes.use('/*', requireIntegration);

integrationRoutes.get('/editions/current/countries', async (context) => {
  const edition = await context.env.DB.prepare('SELECT id, name, slug, phase FROM editions WHERE is_current = 1').first();
  if (!edition) return context.json({ error: { code: 'NOT_FOUND', message: 'No current edition is configured.' } }, 404);
  const rows = await context.env.DB.prepare(`SELECT c.id AS countryId, c.code, c.name AS country, c.flag_emoji AS flag,
    dr.discord_user_id AS discordUserId, dr.delivery_status AS deliveryStatus,
    dr.delivery_error_code AS deliveryErrorCode, dr.delivery_updated_at AS deliveryUpdatedAt,
    CASE WHEN jc.id IS NULL THEN 0 ELSE 1 END AS credentialReady
    FROM entries e JOIN countries c ON c.id = e.country_id
    LEFT JOIN discord_representatives dr ON dr.edition_id = e.edition_id AND dr.country_id = c.id
    LEFT JOIN jury_credentials jc ON jc.edition_id = e.edition_id AND jc.country_id = c.id
    WHERE e.edition_id = ? ORDER BY e.display_order, c.name`).bind(edition.id).all();
  return context.json({ edition, countries: rows.results.map((row) => ({ ...row, credentialReady: Boolean(row.credentialReady) })) });
});

integrationRoutes.put('/editions/:editionId/countries/:countryId/representative', async (context) => {
  const { editionId, countryId } = context.req.param();
  const body = await context.req.json<{ discordUserId?: string }>();
  if (!body.discordUserId || !/^\d{15,22}$/.test(body.discordUserId)) return context.json({ error: { code: 'INVALID_DISCORD_ID', message: 'A valid Discord user ID is required.' } }, 400);
  await context.env.DB.prepare(`INSERT INTO discord_representatives (edition_id, country_id, discord_user_id)
    VALUES (?, ?, ?) ON CONFLICT(edition_id, country_id) DO UPDATE SET discord_user_id = excluded.discord_user_id,
    delivery_status = 'not_sent', delivery_error_code = NULL, delivery_updated_at = NULL, updated_at = CURRENT_TIMESTAMP`)
    .bind(editionId, countryId, body.discordUserId).run();
  await audit(context.env.DB, 'integration', context.get('integrationKeyId'), 'discord.mapping.updated', 'country', countryId, editionId);
  return context.json({ updated: true });
});

integrationRoutes.post('/editions/:editionId/countries/:countryId/credential', async (context) => {
  const { editionId, countryId } = context.req.param();
  const body = await context.req.json<{ mode?: 'generate' | 'set'; password?: string }>();
  if (body.mode !== 'generate' && body.mode !== 'set') return context.json({ error: { code: 'INVALID_MODE', message: 'Credential mode must be generate or set.' } }, 400);
  const generated = body.mode === 'generate';
  const password = generated ? generateJuryPassword() : body.password;
  if (!password) return context.json({ error: { code: 'INVALID_INPUT', message: 'A password is required in set mode.' } }, 400);
  try { await setJuryCredential(context.env.DB, context.env.PASSWORD_PEPPER, editionId, countryId, password); }
  catch (error) { return context.json({ error: { code: 'INVALID_PASSWORD', message: error instanceof Error ? error.message : 'Invalid password.' } }, 400); }
  await context.env.DB.prepare(`UPDATE discord_representatives SET delivery_status = 'not_sent', delivery_error_code = NULL,
    delivery_updated_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE edition_id = ? AND country_id = ?`).bind(editionId, countryId).run();
  await audit(context.env.DB, 'integration', context.get('integrationKeyId'), 'jury.credential.rotated', 'country', countryId, editionId, { generated });
  return context.json({ updated: true, generatedPassword: generated ? password : undefined });
});

integrationRoutes.put('/editions/:editionId/countries/:countryId/delivery', async (context) => {
  const { editionId, countryId } = context.req.param();
  const body = await context.req.json<{ status?: 'sent' | 'failed'; errorCode?: string | null }>();
  if (body.status !== 'sent' && body.status !== 'failed') return context.json({ error: { code: 'INVALID_STATUS', message: 'Delivery status must be sent or failed.' } }, 400);
  await context.env.DB.prepare(`UPDATE discord_representatives SET delivery_status = ?, delivery_error_code = ?,
    delivery_updated_at = ?, updated_at = ? WHERE edition_id = ? AND country_id = ?`)
    .bind(body.status, body.status === 'failed' ? body.errorCode ?? 'DM_UNAVAILABLE' : null, new Date().toISOString(), new Date().toISOString(), editionId, countryId).run();
  await audit(context.env.DB, 'integration', context.get('integrationKeyId'), 'discord.delivery.updated', 'country', countryId, editionId, { status: body.status, errorCode: body.errorCode ?? null });
  return context.json({ updated: true });
});

integrationRoutes.get('/editions/:editionId/jury-statuses', async (context) => {
  const editionId = context.req.param('editionId');
  const onlineSince = new Date(Date.now() - 90_000).toISOString();
  const rows = await context.env.DB.prepare(`SELECT c.id AS countryId, c.code, c.name AS country,
    CASE WHEN b.id IS NOT NULL THEN 'submitted'
      WHEN s.last_seen_at >= ? AND s.status = 'voting' THEN 'voting'
      WHEN s.last_seen_at >= ? THEN 'online' ELSE 'offline' END AS status,
    CASE WHEN b.id IS NULL THEN 0 ELSE 1 END AS submitted,
    s.last_seen_at AS lastSeenAt
    FROM entries e JOIN countries c ON c.id = e.country_id
    LEFT JOIN ballots b ON b.edition_id = e.edition_id AND b.jury_country_id = c.id
    LEFT JOIN active_jury_sessions active ON active.edition_id = e.edition_id AND active.country_id = c.id
    LEFT JOIN jury_sessions s ON s.id = active.session_id AND s.revoked_at IS NULL AND s.expires_at > ?
    WHERE e.edition_id = ? ORDER BY e.display_order, c.name`)
    .bind(onlineSince, onlineSince, new Date().toISOString(), editionId).all();
  return context.json({ editionId, countries: rows.results.map((row) => ({ ...row, submitted: Boolean(row.submitted) })) });
});

integrationRoutes.get('/editions/:editionId/completion', async (context) => {
  const editionId = context.req.param('editionId');
  const rows = await context.env.DB.prepare(`SELECT c.id AS countryId, c.code, c.name AS country,
    CASE WHEN b.id IS NULL THEN 0 ELSE 1 END AS completed
    FROM entries e JOIN countries c ON c.id = e.country_id
    LEFT JOIN ballots b ON b.edition_id = e.edition_id AND b.jury_country_id = c.id
    WHERE e.edition_id = ? ORDER BY e.display_order, c.name`).bind(editionId).all();
  const countries = rows.results.map((row) => ({ ...row, completed: Boolean(row.completed) }));
  return context.json({ editionId, completed: countries.filter((row) => row.completed).length, total: countries.length, countries });
});

