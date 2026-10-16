import { Hono } from 'hono';
import type { Bindings, AppVariables } from '../types';

type AppEnv = { Bindings: Bindings; Variables: AppVariables };
export const publicRoutes = new Hono<AppEnv>();

publicRoutes.get('/contest', async (context) => {
  const edition = await context.env.DB.prepare(`
    SELECT id, slug, name, year, phase, results_public AS resultsPublic,
           public_status_enabled AS publicStatusEnabled, voting_deadline AS votingDeadline
    FROM editions WHERE is_current = 1
  `).first();
  if (!edition) return context.json({ error: { code: 'NO_CURRENT_EDITION', message: 'No contest edition is currently configured.' } }, 404);
  const counts = await context.env.DB.prepare(`
    SELECT COUNT(*) AS participants,
      (SELECT COUNT(*) FROM ballots b WHERE b.edition_id = ?) AS submitted
    FROM entries WHERE edition_id = ?
  `).bind(edition.id, edition.id).first();
  return context.json({ edition: { ...edition, resultsPublic: Boolean(edition.resultsPublic), publicStatusEnabled: Boolean(edition.publicStatusEnabled), ...counts } });
});

publicRoutes.get('/participants', async (context) => {
  const rows = await context.env.DB.prepare(`
    SELECT e.id, c.id AS countryId, c.code, c.name AS country, c.flag_emoji AS flag,
           e.artist, e.song_title AS songTitle, e.youtube_url AS youtubeUrl
    FROM entries e JOIN countries c ON c.id = e.country_id
    JOIN editions ed ON ed.id = e.edition_id
    WHERE ed.is_current = 1 AND c.active = 1 ORDER BY e.display_order, c.name
  `).all();
  return context.json({ participants: rows.results });
});

publicRoutes.get('/status', async (context) => {
  const edition = await context.env.DB.prepare('SELECT id, public_status_enabled AS enabled FROM editions WHERE is_current = 1').first<{ id: string; enabled: number }>();
  if (!edition?.enabled) return context.json({ error: { code: 'NOT_AVAILABLE', message: 'The public jury status is not available.' } }, 404);
  const onlineSince = new Date(Date.now() - 90_000).toISOString();
  const rows = await context.env.DB.prepare(`
    SELECT c.id AS countryId, c.name AS country, c.flag_emoji AS flag,
      CASE
        WHEN b.id IS NOT NULL THEN 'submitted'
        WHEN s.last_seen_at >= ? AND s.status = 'voting' THEN 'voting'
        WHEN s.last_seen_at >= ? THEN 'online'
        ELSE 'offline'
      END AS status
    FROM entries e
    JOIN countries c ON c.id = e.country_id
    LEFT JOIN ballots b ON b.edition_id = e.edition_id AND b.jury_country_id = e.country_id
    LEFT JOIN active_jury_sessions active ON active.edition_id = e.edition_id AND active.country_id = e.country_id
    LEFT JOIN jury_sessions s ON s.id = active.session_id AND s.revoked_at IS NULL AND s.expires_at > ?
    WHERE e.edition_id = ? ORDER BY e.display_order, c.name
  `).bind(onlineSince, onlineSince, new Date().toISOString(), edition.id).all();
  return context.json({ statuses: rows.results });
});

publicRoutes.get('/results', async (context) => {
  const edition = await context.env.DB.prepare(`
    SELECT id, name, results_public AS resultsPublic, results_opened_at AS resultsOpenedAt,
      guest_active AS guestActive, guest_started_at AS guestStartedAt,
      winner_active AS winnerActive, winner_started_at AS winnerStartedAt
    FROM editions WHERE is_current = 1
  `).first<{ id: string; name: string; resultsPublic: number; resultsOpenedAt: string | null; guestActive: number; guestStartedAt: string | null; winnerActive: number; winnerStartedAt: string | null }>();
  if (!edition?.resultsPublic) return context.json({ error: { code: 'RESULTS_HIDDEN', message: 'Results have not been published.' } }, 404);
  const ballotCount = await context.env.DB.prepare('SELECT COUNT(*) AS count FROM ballots WHERE edition_id = ?').bind(edition.id).first<{ count: number }>();
  const rows = await context.env.DB.prepare(`
    WITH revealed_ballots AS (
      SELECT b.id FROM ballots b JOIN jury_reveals jr
        ON jr.edition_id = b.edition_id AND jr.jury_country_id = b.jury_country_id
      WHERE b.edition_id = ?
    )
    SELECT c.id AS countryId, c.name AS country, c.flag_emoji AS flag,
           COALESCE(SUM(bs.points), 0) AS totalPoints
    FROM entries e JOIN countries c ON c.id = e.country_id
    LEFT JOIN ballot_scores bs ON bs.recipient_country_id = c.id AND bs.ballot_id IN (SELECT id FROM revealed_ballots)
    WHERE e.edition_id = ?
    GROUP BY c.id, c.name, c.flag_emoji
    ORDER BY totalPoints DESC, c.name
  `).bind(edition.id, edition.id).all();
  const revealRows = await context.env.DB.prepare(`SELECT jr.reveal_order AS revealOrder,
    jr.revealed_at AS revealedAt, jury.id AS juryCountryId, jury.name AS juryCountry,
    jury.flag_emoji AS juryFlag, recipient.id AS recipientCountryId, recipient.name AS recipientCountry,
    recipient.flag_emoji AS recipientFlag, bs.points
    FROM jury_reveals jr JOIN countries jury ON jury.id = jr.jury_country_id
    JOIN ballots b ON b.edition_id = jr.edition_id AND b.jury_country_id = jr.jury_country_id
    JOIN ballot_scores bs ON bs.ballot_id = b.id
    JOIN countries recipient ON recipient.id = bs.recipient_country_id
    WHERE jr.edition_id = ? ORDER BY jr.reveal_order, bs.points`)
    .bind(edition.id).all<{
      revealOrder: number; revealedAt: string; juryCountryId: string; juryCountry: string; juryFlag: string;
      recipientCountryId: string; recipientCountry: string; recipientFlag: string; points: number;
    }>();
  const reveals = revealRows.results.reduce<Array<{
    revealOrder: number; revealedAt: string; juryCountryId: string; juryCountry: string; juryFlag: string;
    scores: Array<{ countryId: string; country: string; flag: string; points: number }>;
  }>>((result, row) => {
    let reveal = result[result.length - 1];
    if (!reveal || reveal.revealOrder !== row.revealOrder) {
      reveal = { revealOrder: row.revealOrder, revealedAt: row.revealedAt, juryCountryId: row.juryCountryId, juryCountry: row.juryCountry, juryFlag: row.juryFlag, scores: [] };
      result.push(reveal);
    }
    reveal.scores.push({ countryId: row.recipientCountryId, country: row.recipientCountry, flag: row.recipientFlag, points: row.points });
    return result;
  }, []);
  return context.json({ edition: edition.name, resultsOpenedAt: edition.resultsOpenedAt, guestActive: Boolean(edition.guestActive), guestStartedAt: edition.guestStartedAt, winnerActive: Boolean(edition.winnerActive), winnerStartedAt: edition.winnerStartedAt, juriesRevealed: reveals.length, juriesSubmitted: ballotCount?.count ?? 0, scoreboard: rows.results, reveals });
});

publicRoutes.get('/champions', async (context) => {
  const rows = await context.env.DB.prepare(`SELECT id, edition_id AS editionId, edition_name AS editionName,
    edition_year AS editionYear, placement, country_name AS country, country_flag AS flag, artist,
    song_title AS songTitle, total_points AS totalPoints, created_at AS createdAt
    FROM champions ORDER BY edition_year DESC, placement`).all();
  return context.json({ champions: rows.results });
});

