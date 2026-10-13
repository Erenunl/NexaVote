import { Hono } from 'hono';
import type { Bindings, AppVariables } from '../types';
import { requireAdmin, audit, isRateLimited, clearRateLimit } from '../lib/auth';
import { randomToken, sha256, verifyEncodedPassword } from '../lib/crypto';
import { generateJuryPassword, setJuryCredential } from '../lib/credentials';
import { isoAfterMinutes } from '../lib/http';

type AppEnv = { Bindings: Bindings; Variables: AppVariables };
export const adminRoutes = new Hono<AppEnv>();

adminRoutes.post('/login', async (context) => {
  const ip = context.req.header('CF-Connecting-IP') ?? context.req.header('X-Forwarded-For') ?? 'unknown';
  if (await isRateLimited(context.env.DB, 'admin-login', ip, 4)) {
    return context.json({ error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Please wait and try again.' } }, 429);
  }
  const body = await context.req.json<{ password?: string }>().catch(() => ({} as { password?: string }));
  if (!body.password || !(await verifyEncodedPassword(body.password, context.env.ADMIN_PASSWORD_HASH))) {
    return context.json({ error: { code: 'INVALID_CREDENTIALS', message: 'The administrator password is invalid.' } }, 401);
  }
  const token = randomToken();
  const id = crypto.randomUUID();
  const expiresAt = isoAfterMinutes(Number(context.env.ADMIN_SESSION_TTL_MINUTES ?? 120));
  await context.env.DB.prepare('INSERT INTO admin_sessions (id, token_hash, expires_at) VALUES (?, ?, ?)')
    .bind(id, await sha256(token), expiresAt).run();
  await clearRateLimit(context.env.DB, 'admin-login', ip);
  await audit(context.env.DB, 'admin', id, 'admin.login');
  return context.json({ token, expiresAt });
});

adminRoutes.use('/*', requireAdmin);

adminRoutes.get('/dashboard', async (context) => {
  const edition = await context.env.DB.prepare(`SELECT id, name, slug, year, phase, results_public AS resultsPublic,
    public_status_enabled AS publicStatusEnabled, reveal_count AS revealCount, voting_deadline AS votingDeadline,
    results_opened_at AS resultsOpenedAt
    FROM editions WHERE is_current = 1`).first();
  if (!edition) return context.json({ edition: null, stats: null, juries: [] });
  const onlineSince = new Date(Date.now() - 90_000).toISOString();
  const juries = await context.env.DB.prepare(`
    SELECT c.id AS countryId, c.name AS country, c.code, c.flag_emoji AS flag,
      dr.discord_user_id AS discordUserId, dr.delivery_status AS deliveryStatus,
      CASE WHEN jc.id IS NULL THEN 0 ELSE 1 END AS credentialReady,
      CASE WHEN b.id IS NOT NULL THEN 'submitted'
           WHEN s.last_seen_at >= ? AND s.status = 'voting' THEN 'voting'
           WHEN s.last_seen_at >= ? THEN 'online' ELSE 'offline' END AS status
    FROM entries e JOIN countries c ON c.id = e.country_id
    LEFT JOIN jury_credentials jc ON jc.edition_id = e.edition_id AND jc.country_id = c.id
    LEFT JOIN discord_representatives dr ON dr.edition_id = e.edition_id AND dr.country_id = c.id
    LEFT JOIN ballots b ON b.edition_id = e.edition_id AND b.jury_country_id = c.id
    LEFT JOIN active_jury_sessions active ON active.edition_id = e.edition_id AND active.country_id = c.id
    LEFT JOIN jury_sessions s ON s.id = active.session_id AND s.revoked_at IS NULL AND s.expires_at > ?
    WHERE e.edition_id = ? ORDER BY e.display_order, c.name
  `).bind(onlineSince, onlineSince, new Date().toISOString(), edition.id).all();
  const submitted = juries.results.filter((item) => item.status === 'submitted').length;
  const online = juries.results.filter((item) => item.status === 'online' || item.status === 'voting').length;
  return context.json({ edition: { ...edition, resultsPublic: Boolean(edition.resultsPublic), publicStatusEnabled: Boolean(edition.publicStatusEnabled) }, stats: { total: juries.results.length, submitted, online, remaining: juries.results.length - submitted }, juries: juries.results });
});

adminRoutes.get('/editions', async (context) => {
  const editions = await context.env.DB.prepare('SELECT * FROM editions ORDER BY year DESC, created_at DESC').all();
  return context.json({ editions: editions.results });
});

adminRoutes.post('/editions', async (context) => {
  const body = await context.req.json<{ name?: string; slug?: string; year?: number; votingDeadline?: string | null }>();
  if (!body.name || !body.slug || !Number.isInteger(body.year)) return context.json({ error: { code: 'INVALID_INPUT', message: 'Name, slug, and year are required.' } }, 400);
  const id = crypto.randomUUID();
  await context.env.DB.prepare('INSERT INTO editions (id, slug, name, year, voting_deadline) VALUES (?, ?, ?, ?, ?)')
    .bind(id, body.slug, body.name, body.year, body.votingDeadline ?? null).run();
  await audit(context.env.DB, 'admin', context.get('adminSessionId'), 'edition.created', 'edition', id, id);
  return context.json({ id }, 201);
});

adminRoutes.patch('/editions/:editionId', async (context) => {
  const id = context.req.param('editionId');
  const body = await context.req.json<{ phase?: string; resultsPublic?: boolean; publicStatusEnabled?: boolean; revealCount?: number; votingDeadline?: string | null; makeCurrent?: boolean }>();
  if (body.phase && !['draft', 'open', 'closed'].includes(body.phase)) return context.json({ error: { code: 'INVALID_PHASE', message: 'Invalid voting phase.' } }, 400);
  if (body.makeCurrent) await context.env.DB.prepare('UPDATE editions SET is_current = 0 WHERE is_current = 1').run();
  const current = await context.env.DB.prepare('SELECT results_public AS resultsPublic, results_opened_at AS resultsOpenedAt FROM editions WHERE id = ?')
    .bind(id).first<{ resultsPublic: number; resultsOpenedAt: string | null }>();
  if (!current) return context.json({ error: { code: 'NOT_FOUND', message: 'Edition not found.' } }, 404);
  const now = new Date().toISOString();
  const resultsOpenedAt = body.resultsPublic === undefined
    ? current.resultsOpenedAt
    : body.resultsPublic
      ? (current.resultsPublic ? current.resultsOpenedAt : now)
      : null;
  await context.env.DB.prepare(`UPDATE editions SET
    phase = COALESCE(?, phase), results_public = COALESCE(?, results_public),
    public_status_enabled = COALESCE(?, public_status_enabled), reveal_count = COALESCE(?, reveal_count),
    voting_deadline = CASE WHEN ? = 1 THEN ? ELSE voting_deadline END,
    results_opened_at = ?, is_current = CASE WHEN ? = 1 THEN 1 ELSE is_current END, updated_at = ? WHERE id = ?`)
    .bind(body.phase ?? null, body.resultsPublic === undefined ? null : Number(body.resultsPublic), body.publicStatusEnabled === undefined ? null : Number(body.publicStatusEnabled),
      body.revealCount ?? null, body.votingDeadline === undefined ? 0 : 1, body.votingDeadline ?? null, resultsOpenedAt,
      body.makeCurrent ? 1 : 0, now, id).run();
  await audit(context.env.DB, 'admin', context.get('adminSessionId'), 'edition.updated', 'edition', id, id, { fields: Object.keys(body) });
  return context.json({ updated: true });
});

adminRoutes.get('/entries', async (context) => {
  const editionId = context.req.query('editionId') ?? (await currentEditionId(context.env.DB));
  const rows = await context.env.DB.prepare(`SELECT e.id, e.edition_id AS editionId, c.id AS countryId, c.code, c.name AS country,
    c.flag_emoji AS flag, e.artist, e.song_title AS songTitle, e.youtube_url AS youtubeUrl, e.display_order AS displayOrder
    FROM entries e JOIN countries c ON c.id = e.country_id WHERE e.edition_id = ? ORDER BY e.display_order, c.name`).bind(editionId).all();
  return context.json({ entries: rows.results });
});

adminRoutes.post('/entries', async (context) => {
  const body = await context.req.json<{ editionId?: string; code?: string; country?: string; flag?: string; artist?: string; songTitle?: string; youtubeUrl?: string | null; displayOrder?: number }>();
  if (!body.editionId || !body.code || !body.country || !body.flag || !body.artist || !body.songTitle) return context.json({ error: { code: 'INVALID_INPUT', message: 'Edition, country, artist, and song are required.' } }, 400);
  const existingCountry = await context.env.DB.prepare('SELECT id FROM countries WHERE code = ?').bind(body.code.toUpperCase()).first<{ id: string }>();
  const countryId = existingCountry?.id ?? crypto.randomUUID();
  const entryId = crypto.randomUUID();
  const statements = [
    context.env.DB.prepare('INSERT INTO entries (id, edition_id, country_id, artist, song_title, youtube_url, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(entryId, body.editionId, countryId, body.artist, body.songTitle, body.youtubeUrl ?? null, body.displayOrder ?? 0),
  ];
  if (existingCountry) statements.unshift(context.env.DB.prepare('UPDATE countries SET name = ?, flag_emoji = ?, active = 1 WHERE id = ?').bind(body.country, body.flag, countryId));
  else statements.unshift(context.env.DB.prepare('INSERT INTO countries (id, code, name, flag_emoji) VALUES (?, ?, ?, ?)').bind(countryId, body.code.toUpperCase(), body.country, body.flag));
  await context.env.DB.batch(statements);
  await audit(context.env.DB, 'admin', context.get('adminSessionId'), 'entry.created', 'entry', entryId, body.editionId);
  return context.json({ entryId, countryId }, 201);
});

adminRoutes.patch('/entries/:entryId', async (context) => {
  const id = context.req.param('entryId');
  const body = await context.req.json<{ country?: string; flag?: string; artist?: string; songTitle?: string; youtubeUrl?: string | null; displayOrder?: number }>();
  const entry = await context.env.DB.prepare('SELECT edition_id AS editionId, country_id AS countryId FROM entries WHERE id = ?').bind(id).first<{ editionId: string; countryId: string }>();
  if (!entry) return context.json({ error: { code: 'NOT_FOUND', message: 'Entry not found.' } }, 404);
  await context.env.DB.batch([
    context.env.DB.prepare('UPDATE entries SET artist = COALESCE(?, artist), song_title = COALESCE(?, song_title), youtube_url = CASE WHEN ? = 1 THEN ? ELSE youtube_url END, display_order = COALESCE(?, display_order), updated_at = ? WHERE id = ?')
      .bind(body.artist ?? null, body.songTitle ?? null, body.youtubeUrl === undefined ? 0 : 1, body.youtubeUrl ?? null, body.displayOrder ?? null, new Date().toISOString(), id),
    context.env.DB.prepare('UPDATE countries SET name = COALESCE(?, name), flag_emoji = COALESCE(?, flag_emoji) WHERE id = ?')
      .bind(body.country ?? null, body.flag ?? null, entry.countryId),
  ]);
  await audit(context.env.DB, 'admin', context.get('adminSessionId'), 'entry.updated', 'entry', id, entry.editionId);
  return context.json({ updated: true });
});

adminRoutes.put('/editions/:editionId/countries/:countryId/discord', async (context) => {
  const { editionId, countryId } = context.req.param();
  const body = await context.req.json<{ discordUserId?: string }>();
  if (!body.discordUserId || !/^\d{15,22}$/.test(body.discordUserId)) return context.json({ error: { code: 'INVALID_DISCORD_ID', message: 'A valid Discord user ID is required.' } }, 400);
  await context.env.DB.prepare(`INSERT INTO discord_representatives (edition_id, country_id, discord_user_id)
    VALUES (?, ?, ?) ON CONFLICT(edition_id, country_id) DO UPDATE SET discord_user_id = excluded.discord_user_id,
    delivery_status = 'not_sent', delivery_error_code = NULL, updated_at = CURRENT_TIMESTAMP`)
    .bind(editionId, countryId, body.discordUserId).run();
  await audit(context.env.DB, 'admin', context.get('adminSessionId'), 'discord.mapping.updated', 'country', countryId, editionId);
  return context.json({ updated: true });
});

adminRoutes.post('/editions/:editionId/countries/:countryId/credential', async (context) => {
  const { editionId, countryId } = context.req.param();
  const body = await context.req.json<{ password?: string; generate?: boolean }>().catch(() => ({} as { password?: string; generate?: boolean }));
  const generated = body.generate === true;
  const password = generated ? generateJuryPassword() : body.password;
  if (!password) return context.json({ error: { code: 'INVALID_INPUT', message: 'Provide a password or request generation.' } }, 400);
  try { await setJuryCredential(context.env.DB, context.env.PASSWORD_PEPPER, editionId, countryId, password); }
  catch (error) { return context.json({ error: { code: 'INVALID_PASSWORD', message: error instanceof Error ? error.message : 'Invalid password.' } }, 400); }
  await audit(context.env.DB, 'admin', context.get('adminSessionId'), 'jury.credential.rotated', 'country', countryId, editionId, { generated });
  return context.json({ updated: true, generatedPassword: generated ? password : undefined });
});

adminRoutes.post('/editions/:editionId/countries/:countryId/revoke-session', async (context) => {
  const { editionId, countryId } = context.req.param();
  const active = await context.env.DB.prepare('SELECT session_id AS sessionId FROM active_jury_sessions WHERE edition_id = ? AND country_id = ?').bind(editionId, countryId).first<{ sessionId: string }>();
  if (active) await context.env.DB.batch([
    context.env.DB.prepare('UPDATE jury_sessions SET revoked_at = ? WHERE id = ?').bind(new Date().toISOString(), active.sessionId),
    context.env.DB.prepare('DELETE FROM active_jury_sessions WHERE session_id = ?').bind(active.sessionId),
  ]);
  await audit(context.env.DB, 'admin', context.get('adminSessionId'), 'jury.session.revoked', 'country', countryId, editionId);
  return context.json({ revoked: Boolean(active) });
});

adminRoutes.delete('/editions/:editionId/countries/:countryId/ballot', async (context) => {
  const { editionId, countryId } = context.req.param();
  const ballot = await context.env.DB.prepare('SELECT id FROM ballots WHERE edition_id = ? AND jury_country_id = ?').bind(editionId, countryId).first<{ id: string }>();
  if (ballot) await context.env.DB.prepare('DELETE FROM ballots WHERE id = ?').bind(ballot.id).run();
  await audit(context.env.DB, 'admin', context.get('adminSessionId'), 'ballot.reset', 'country', countryId, editionId);
  return context.json({ reset: Boolean(ballot) });
});

adminRoutes.get('/results', async (context) => {
  const editionId = context.req.query('editionId') ?? (await currentEditionId(context.env.DB));
  const scoreboard = await context.env.DB.prepare(`SELECT c.id AS countryId, c.name AS country, c.flag_emoji AS flag,
    COALESCE(SUM(CASE WHEN b.id IS NOT NULL THEN bs.points ELSE 0 END), 0) AS totalPoints
    FROM entries e JOIN countries c ON c.id = e.country_id
    LEFT JOIN ballot_scores bs ON bs.recipient_country_id = c.id
    LEFT JOIN ballots b ON b.id = bs.ballot_id AND b.edition_id = e.edition_id
    WHERE e.edition_id = ? GROUP BY c.id, c.name, c.flag_emoji ORDER BY totalPoints DESC, c.name`).bind(editionId).all();
  const breakdown = await context.env.DB.prepare(`SELECT jury.name AS juryCountry, recipient.name AS recipientCountry, bs.points
    FROM ballots b JOIN countries jury ON jury.id = b.jury_country_id
    JOIN ballot_scores bs ON bs.ballot_id = b.id JOIN countries recipient ON recipient.id = bs.recipient_country_id
    WHERE b.edition_id = ? ORDER BY b.submitted_at, bs.points DESC`).bind(editionId).all();
  const submittedJuries = await context.env.DB.prepare(`SELECT jury.id AS countryId, jury.name AS country,
    jury.flag_emoji AS flag, b.submitted_at AS submittedAt, jr.reveal_order AS revealOrder,
    jr.revealed_at AS revealedAt
    FROM ballots b JOIN countries jury ON jury.id = b.jury_country_id
    LEFT JOIN jury_reveals jr ON jr.edition_id = b.edition_id AND jr.jury_country_id = b.jury_country_id
    WHERE b.edition_id = ?
    ORDER BY CASE WHEN jr.reveal_order IS NULL THEN 1 ELSE 0 END, jr.reveal_order, b.submitted_at, jury.name`)
    .bind(editionId).all();
  return context.json({ scoreboard: scoreboard.results, breakdown: breakdown.results, submittedJuries: submittedJuries.results });
});

adminRoutes.post('/editions/:editionId/reveals/:countryId', async (context) => {
  const { editionId, countryId } = context.req.param();
  const ballot = await context.env.DB.prepare('SELECT id FROM ballots WHERE edition_id = ? AND jury_country_id = ?')
    .bind(editionId, countryId).first();
  if (!ballot) return context.json({ error: { code: 'JURY_NOT_SUBMITTED', message: 'This jury has not submitted a ballot yet.' } }, 409);
  const existing = await context.env.DB.prepare('SELECT reveal_order AS revealOrder FROM jury_reveals WHERE edition_id = ? AND jury_country_id = ?')
    .bind(editionId, countryId).first<{ revealOrder: number }>();
  if (existing) return context.json({ error: { code: 'JURY_ALREADY_REVEALED', message: 'This jury has already been revealed.' } }, 409);
  const sequence = await context.env.DB.prepare(`UPDATE editions
    SET reveal_count = MAX(reveal_count, COALESCE((SELECT MAX(reveal_order) FROM jury_reveals WHERE edition_id = ?), 0)) + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? RETURNING reveal_count AS revealOrder`)
    .bind(editionId, editionId).first<{ revealOrder: number }>();
  if (!sequence) return context.json({ error: { code: 'EDITION_NOT_FOUND', message: 'Edition not found.' } }, 404);
  const id = crypto.randomUUID();
  await context.env.DB.prepare('INSERT INTO jury_reveals (id, edition_id, jury_country_id, reveal_order) VALUES (?, ?, ?, ?)')
    .bind(id, editionId, countryId, sequence.revealOrder).run();
  const reveal = await context.env.DB.prepare('SELECT reveal_order AS revealOrder, revealed_at AS revealedAt FROM jury_reveals WHERE id = ?')
    .bind(id).first();
  await audit(context.env.DB, 'admin', context.get('adminSessionId'), 'results.jury_revealed', 'country', countryId, editionId, reveal ?? {});
  return context.json({ revealed: true, ...reveal }, 201);
});

adminRoutes.delete('/editions/:editionId/reveals/:countryId', async (context) => {
  const { editionId, countryId } = context.req.param();
  const reveal = await context.env.DB.prepare(`SELECT reveal_order AS revealOrder, revealed_at AS revealedAt
    FROM jury_reveals WHERE edition_id = ? AND jury_country_id = ?`)
    .bind(editionId, countryId).first<{ revealOrder: number; revealedAt: string }>();
  if (!reveal) return context.json({ error: { code: 'JURY_NOT_REVEALED', message: 'This jury has not been revealed.' } }, 404);
  await context.env.DB.prepare('DELETE FROM jury_reveals WHERE edition_id = ? AND jury_country_id = ?')
    .bind(editionId, countryId).run();
  await audit(context.env.DB, 'admin', context.get('adminSessionId'), 'results.jury_reveal_removed', 'country', countryId, editionId, reveal);
  return context.json({ removed: true });
});

adminRoutes.get('/export', async (context) => {
  const editionId = context.req.query('editionId') ?? (await currentEditionId(context.env.DB));
  const format = context.req.query('format') === 'csv' ? 'csv' : 'json';
  const rows = await context.env.DB.prepare(`SELECT jury.name AS juryCountry, recipient.name AS recipientCountry, bs.points, b.submitted_at AS submittedAt
    FROM ballots b JOIN countries jury ON jury.id = b.jury_country_id JOIN ballot_scores bs ON bs.ballot_id = b.id
    JOIN countries recipient ON recipient.id = bs.recipient_country_id WHERE b.edition_id = ? ORDER BY jury.name, bs.points DESC`).bind(editionId).all();
  if (format === 'json') return context.json({ editionId, votes: rows.results });
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = ['jury_country,recipient_country,points,submitted_at', ...rows.results.map((row) => [row.juryCountry, row.recipientCountry, row.points, row.submittedAt].map(escape).join(','))].join('\n');
  context.header('Content-Type', 'text/csv; charset=utf-8');
  context.header('Content-Disposition', `attachment; filename="nexavision-${editionId}-results.csv"`);
  return context.body(csv);
});

adminRoutes.get('/audit-log', async (context) => {
  const rows = await context.env.DB.prepare(`SELECT id, edition_id AS editionId, actor_type AS actorType, actor_id AS actorId,
    action, target_type AS targetType, target_id AS targetId, metadata_json AS metadata, created_at AS createdAt
    FROM audit_logs ORDER BY created_at DESC LIMIT 250`).all();
  return context.json({ events: rows.results.map((row) => ({ ...row, metadata: JSON.parse(String(row.metadata)) })) });
});

async function currentEditionId(db: D1Database): Promise<string> {
  const row = await db.prepare('SELECT id FROM editions WHERE is_current = 1').first<{ id: string }>();
  if (!row) throw new Error('No current edition configured.');
  return row.id;
}

