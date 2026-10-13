import { hashPassword, passwordLookup, randomToken } from './crypto';

export function generateJuryPassword(): string {
  const raw = randomToken(18).replace(/[-_]/g, '');
  return `NXV-${raw.slice(0, 6)}-${raw.slice(6, 12)}-${raw.slice(12, 18)}`;
}

export async function setJuryCredential(
  db: D1Database,
  pepper: string,
  editionId: string,
  countryId: string,
  password: string,
) {
  if (password.length < 12 || password.length > 256) throw new Error('Password must be between 12 and 256 characters.');
  const prepared = await hashPassword(password);
  const lookup = await passwordLookup(password, pepper);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const activeSessions = await db.prepare('SELECT session_id AS sessionId FROM active_jury_sessions WHERE edition_id = ? AND country_id = ?')
    .bind(editionId, countryId).all<{ sessionId: string }>();
  const statements: D1PreparedStatement[] = [
    db.prepare(`INSERT INTO jury_credentials
      (id, edition_id, country_id, lookup_hash, password_hash, password_salt, iterations, version, rotated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
      ON CONFLICT(edition_id, country_id) DO UPDATE SET
        lookup_hash = excluded.lookup_hash, password_hash = excluded.password_hash,
        password_salt = excluded.password_salt, iterations = excluded.iterations,
        version = jury_credentials.version + 1, rotated_at = excluded.rotated_at`)
      .bind(id, editionId, countryId, lookup, prepared.hash, prepared.salt, prepared.iterations, now),
    db.prepare('DELETE FROM active_jury_sessions WHERE edition_id = ? AND country_id = ?').bind(editionId, countryId),
  ];
  for (const session of activeSessions.results) {
    statements.push(db.prepare('UPDATE jury_sessions SET revoked_at = ? WHERE id = ?').bind(now, session.sessionId));
  }
  await db.batch(statements);
}

