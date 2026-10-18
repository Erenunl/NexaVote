import { describe, expect, it } from 'vitest';
import { mediaPosition, normalizeStageMedia } from '../../web/src/lib/stageMedia';

describe('temporary stage media', () => {
  const sample = { id: 'cue', source: 'winner', playing: true, position: 2, startedAt: 1000, volume: 0.75, muted: false };
  it('clears the media on removal and rejects local or arbitrary URLs', () => {
    expect(normalizeStageMedia(null)).toBeNull();
    expect(normalizeStageMedia({ ...sample, source: 'blob:local-file' })).toBeNull();
    expect(normalizeStageMedia({ ...sample, source: 'https://untrusted.example/a.mp4' })).toBeNull();
  });
  it('accepts the existing site library and bounds volume', () => {
    expect(normalizeStageMedia(sample)).toEqual(sample);
    expect(normalizeStageMedia({ ...sample, volume: 2 })?.volume).toBe(1);
    expect(normalizeStageMedia({ ...sample, volume: NaN })?.volume).toBe(0.75);
  });
  it('late viewers join the current position, never restart the cue', () => {
    expect(mediaPosition(sample, 30, 6000)).toBe(7);
    expect(mediaPosition({ ...sample, playing: false }, 30, 6000)).toBe(2);
    expect(mediaPosition(sample, 6, 6000)).toBeCloseTo(5.95);
  });
});
