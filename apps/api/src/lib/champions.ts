export type Champion = {
  id: string;
  editionId: string;
  editionName: string;
  editionYear: number;
  placement: number;
  countryId: string;
  country: string;
  flag: string;
  artist: string;
  songTitle: string;
  totalPoints: number;
  createdAt: string;
};

type PodiumEntry = {
  countryId: string;
  country: string;
  flag: string;
  artist: string;
  songTitle: string;
  totalPoints: number;
};

export async function snapshotEditionPodium(db: D1Database, editionId: string): Promise<Champion[]> {
  const edition = await db.prepare('SELECT name, year FROM editions WHERE id = ?')
    .bind(editionId).first<{ name: string; year: number }>();
  if (!edition) throw new Error('Edition not found.');

  const podium = await db.prepare(`SELECT c.id AS countryId, c.name AS country, c.flag_emoji AS flag,
    e.artist, e.song_title AS songTitle,
    COALESCE(SUM(CASE WHEN b.id IS NOT NULL THEN bs.points ELSE 0 END), 0) AS totalPoints
    FROM entries e JOIN countries c ON c.id = e.country_id
    LEFT JOIN ballot_scores bs ON bs.recipient_country_id = c.id
    LEFT JOIN ballots b ON b.id = bs.ballot_id AND b.edition_id = e.edition_id
    WHERE e.edition_id = ?
    GROUP BY c.id, c.name, c.flag_emoji, e.artist, e.song_title
    ORDER BY totalPoints DESC, c.name LIMIT 3`)
    .bind(editionId).all<PodiumEntry>();
  if (podium.results.length < 3 || Number(podium.results[0]?.totalPoints ?? 0) <= 0) return [];

  const now = new Date().toISOString();
  const rows: Champion[] = podium.results.map((entry, index) => ({
    id: crypto.randomUUID(),
    editionId,
    editionName: edition.name,
    editionYear: edition.year,
    placement: index + 1,
    countryId: entry.countryId,
    country: entry.country,
    flag: entry.flag,
    artist: entry.artist,
    songTitle: entry.songTitle,
    totalPoints: Number(entry.totalPoints),
    createdAt: now,
  }));

  await db.batch([
    db.prepare('DELETE FROM champions WHERE edition_id = ?').bind(editionId),
    ...rows.map((row) => db.prepare(`INSERT INTO champions
      (id, edition_id, edition_name, edition_year, placement, country_id, country_name, country_flag, artist, song_title, total_points, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(row.id, row.editionId, row.editionName, row.editionYear, row.placement, row.countryId, row.country, row.flag, row.artist, row.songTitle, row.totalPoints, row.createdAt)),
  ]);
  return rows;
}
