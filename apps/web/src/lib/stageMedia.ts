export type StageMedia = {
  id: string;
  source: string;
  playing: boolean;
  position: number;
  startedAt: number | null;
  volume: number;
  muted: boolean;
};

export const stageVideos = [
  { id: 'winner', file: 'winner-studio.mp4', label: 'Tamta · Birinci stüdyo videosu' },
  { id: 'guest', file: 'guest-performance.mp4', label: 'Sertab Erener · Konuk performansı' },
  { id: 'opening', file: 'results-opening.mp4', label: 'Nexavision · Açılış videosu' },
] as const;

export function normalizeStageMedia(value: unknown): StageMedia | null {
  if (!value || typeof value !== 'object') return null;
  const media = value as Partial<StageMedia>;
  if (typeof media.id !== 'string' || !stageVideos.some((video) => video.id === media.source)) return null;
  return {
    id: media.id.slice(0, 100), source: media.source!, playing: media.playing === true,
    position: typeof media.position === 'number' && Number.isFinite(media.position) ? Math.max(0, media.position) : 0,
    startedAt: typeof media.startedAt === 'number' && Number.isFinite(media.startedAt) ? media.startedAt : null,
    volume: typeof media.volume === 'number' && Number.isFinite(media.volume) ? Math.min(1, Math.max(0, media.volume)) : 0.75,
    muted: media.muted === true,
  };
}

export function mediaPosition(media: StageMedia, duration: number, now = Date.now()) {
  const elapsed = media.playing && media.startedAt !== null ? Math.max(0, (now - media.startedAt) / 1000) : 0;
  return Math.min(Number.isFinite(duration) ? Math.max(0, duration - 0.05) : Infinity, media.position + elapsed);
}
