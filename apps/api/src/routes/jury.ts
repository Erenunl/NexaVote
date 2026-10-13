import { Hono } from 'hono';
import type { Bindings, AppVariables } from '../types';
import { POINTS } from '../types';
import { requireJury, audit, clearRateLimit, isRateLimited } from '../lib/auth';
import { passwordLookup, randomToken, sha256, verifyPassword } from '../lib/crypto';
import { isoAfterMinutes } from '../lib/http';
import { validateBallot, type ScoreInput } from '../lib/ballot';

type AppEnv = { Bindings: Bindings; Variables: AppVariables };
export const juryRoutes = new Hono<AppEnv>();

juryRoutes.post('/login', async (context) => {
  const ip = context.req.header('CF-Connecting-IP') ?? context.req.header('X-Forwarded-For') ?? 'unknown';
  if (await isRateLimited(context.env.DB, 'jury-login', ip)) {
    return context.json({ error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Please wait and try again.' } }, 429);
  }
  const body = await context.req.json<{ password?: string }>().catch(() => ({} as { password?: string }));
  const password = typeof body.password === 'string' ? body.password.trim() : '';
  if (!password || password.length > 256) {
    return context.json({ error: { code: 'INVALID_CREDENTIALS', message: 'The access password is invalid.' } }, 401);
  }
  const lookup = await passwordLookup(password, context.env.PASSWORD_PEPPER);
  const credential = await context.env.DB.prepare(`
    SELECT jc.edition_id AS editionId, jc.country_id AS countryId, jc.password_hash AS passwordHash,
           jc.password_salt AS passwordSalt, jc.iterations, jc.version, c.name AS countryName,
           c.code AS countryCode, c.flag_emoji AS flagEmoji, ed.phase
    FROM jury_credentials jc JOIN editions ed ON ed.id = jc.edition_id
    JOIN countries c ON c.id = jc.country_id
    WHERE ed.is_current = 1 AND jc.lookup_hash = ?
  `).bind(lookup).first<{
    editionId: string; countryId: string; passwordHash: string; passwordSalt: string; iterations: number;
    version: number; countryName: string; countryCode: string; flagEmoji: string; phase: string;
  }>();
  if (!credential || !(await verifyPassword(password, credential.passwordSalt, credential.passwordHash, credential.iterations))) {
    return context.json({ error: { code: 'INVALID_CREDENTIALS', message: 'The access password is invalid.' } }, 401);
  }

  const staleBefore = new Date(Date.now() - 2 * 60_000).toISOString();
  const active = await context.env.DB.prepare(`
    SELECT s.id, s.last_seen_at AS lastSeenAt FROM active_jury_sessions active
    JOIN jury_sessions s ON s.id = active.session_id
    WHERE active.edition_id = ? AND active.country_id = ?
  `).bind(credential.editionId, credential.countryId).first<{ id: string; lastSeenAt: string }>();
  if (active && active.lastSeenAt >= staleBefore) {
    return context.json({ error: { code: 'SESSION_ACTIVE', message: 'This jury already has an active session. Reuse the existing browser or wait briefly for it to expire.' } }, 409);
  }
  if (active) {
    await context.env.DB.batch([
      context.env.DB.prepare('UPDATE jury_sessions SET revoked_at = ? WHERE id = ?').bind(new Date().toISOString(), active.id),
      context.env.DB.prepare('DELETE FROM active_jury_sessions WHERE session_id = ?').bind(active.id),
    ]);
  }

  const sessionId = crypto.randomUUID();
  const token = randomToken();
  const now = new Date().toISOString();
  const expiresAt = isoAfterMinutes(Number(context.env.SESSION_TTL_MINUTES ?? 30));
  try {
    await context.env.DB.batch([
      context.env.DB.prepare(`INSERT INTO jury_sessions
        (id, edition_id, country_id, credential_version, token_hash, status, last_seen_at, expires_at)
        VALUES (?, ?, ?, ?, ?, 'online', ?, ?)`)
        .bind(sessionId, credential.editionId, credential.countryId, credential.version, await sha256(token), now, expiresAt),
      context.env.DB.prepare('INSERT INTO active_jury_sessions (edition_id, country_id, session_id) VALUES (?, ?, ?)')
        .bind(credential.editionId, credential.countryId, sessionId),
    ]);
  } catch {
    return context.json({ error: { code: 'SESSION_ACTIVE', message: 'This jury already has an active session.' } }, 409);
  }
  await clearRateLimit(context.env.DB, 'jury-login', ip);
  await audit(context.env.DB, 'jury', credential.countryId, 'jury.login', 'session', sessionId, credential.editionId);
  return context.json({
    token,
    expiresAt,
    jury: { countryId: credential.countryId, country: credential.countryName, code: credential.countryCode, flag: credential.flagEmoji },
  });
});

juryRoutes.use('/*', requireJury);

juryRoutes.get('/me', async (context) => {
  const jury = context.get('jury');
  const edition = await context.env.DB.prepare('SELECT name, phase, voting_deadline AS votingDeadline FROM editions WHERE id = ?')
    .bind(jury.editionId).first();
  const ballot = await context.env.DB.prepare('SELECT id, submitted_at AS submittedAt FROM ballots WHERE edition_id = ? AND jury_country_id = ?')
    .bind(jury.editionId, jury.countryId).first();
  return context.json({ jury: { countryId: jury.countryId, country: jury.countryName, code: jury.countryCode, flag: jury.flagEmoji }, edition, submitted: Boolean(ballot), ballot });
});

juryRoutes.post('/heartbeat', async (context) => {
  const jury = context.get('jury');
  const body = await context.req.json<{ status?: string }>().catch(() => ({} as { status?: string }));
  const status = body.status === 'voting' ? 'voting' : 'online';
  const expiresAt = isoAfterMinutes(Number(context.env.SESSION_TTL_MINUTES ?? 30));
  await context.env.DB.prepare('UPDATE jury_sessions SET status = ?, last_seen_at = ?, expires_at = ? WHERE id = ?')
    .bind(status, new Date().toISOString(), expiresAt, jury.sessionId).run();
  return context.json({ status, expiresAt });
});

juryRoutes.get('/ballot', async (context) => {
  const jury = context.get('jury');
  const participants = await context.env.DB.prepare(`
    SELECT c.id AS countryId, c.name AS country, c.flag_emoji AS flag, e.artist,
           e.song_title AS songTitle, e.youtube_url AS youtubeUrl
    FROM entries e JOIN countries c ON c.id = e.country_id
    WHERE e.edition_id = ? AND c.id <> ? ORDER BY e.display_order, c.name
  `).bind(jury.editionId, jury.countryId).all();
  const submitted = await context.env.DB.prepare(`
    SELECT bs.recipient_country_id AS countryId, c.name AS country, c.flag_emoji AS flag, bs.points
    FROM ballots b JOIN ballot_scores bs ON bs.ballot_id = b.id
    JOIN countries c ON c.id = bs.recipient_country_id
    WHERE b.edition_id = ? AND b.jury_country_id = ? ORDER BY bs.points DESC
  `).bind(jury.editionId, jury.countryId).all();
  return context.json({ points: POINTS, participants: participants.results, submittedScores: submitted.results });
});

juryRoutes.post('/ballot', async (context) => {
  const jury = context.get('jury');
  const edition = await context.env.DB.prepare('SELECT phase FROM editions WHERE id = ?').bind(jury.editionId).first<{ phase: string }>();
  if (edition?.phase !== 'open') return context.json({ error: { code: 'VOTING_CLOSED', message: 'Voting is not open.' } }, 409);
  const body = await context.req.json<{ scores?: ScoreInput[] }>().catch(() => ({} as { scores?: ScoreInput[] }));
  const scores = Array.isArray(body.scores) ? body.scores : [];
  const eligibleRows = await context.env.DB.prepare('SELECT country_id AS countryId FROM entries WHERE edition_id = ?').bind(jury.editionId).all<{ countryId: string }>();
  const errors = validateBallot(scores, jury.countryId, new Set(eligibleRows.results.map((row) => row.countryId)));
  if (errors.length) return context.json({ error: { code: 'INVALID_BALLOT', message: errors[0], details: errors } }, 400);

  const ballotId = crypto.randomUUID();
  const statements = [
    context.env.DB.prepare('INSERT INTO ballots (id, edition_id, jury_country_id, session_id) VALUES (?, ?, ?, ?)')
      .bind(ballotId, jury.editionId, jury.countryId, jury.sessionId),
    ...scores.map((score) => context.env.DB.prepare('INSERT INTO ballot_scores (id, ballot_id, recipient_country_id, points) VALUES (?, ?, ?, ?)')
      .bind(crypto.randomUUID(), ballotId, score.countryId, score.points)),
  ];
  try {
    await context.env.DB.batch(statements);
  } catch {
    return context.json({ error: { code: 'BALLOT_ALREADY_SUBMITTED', message: 'This jury has already submitted a ballot.' } }, 409);
  }
  await audit(context.env.DB, 'jury', jury.countryId, 'ballot.submitted', 'ballot', ballotId, jury.editionId);
  return context.json({ submitted: true, ballotId }, 201);
});

juryRoutes.post('/logout', async (context) => {
  const jury = context.get('jury');
  const now = new Date().toISOString();
  await context.env.DB.batch([
    context.env.DB.prepare('UPDATE jury_sessions SET revoked_at = ? WHERE id = ?').bind(now, jury.sessionId),
    context.env.DB.prepare('DELETE FROM active_jury_sessions WHERE session_id = ?').bind(jury.sessionId),
  ]);
  return context.json({ loggedOut: true });
});

