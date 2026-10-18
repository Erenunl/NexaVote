import { describe, expect, it, vi } from 'vitest';
import { StagePlayback, type PlaybackVideo, type PlaybackPhase } from '../../web/src/lib/stagePlayback';

function fixture() {
  let now = 0;
  let time = 0;
  const seeks: number[] = [];
  const phases: PlaybackPhase[] = [];
  const video: PlaybackVideo = {
    get currentTime() { return time; }, set currentTime(value) { seeks.push(value); time = value; },
    duration: 300, readyState: 4, paused: true, seeking: false, ended: false, volume: 1, muted: true, playbackRate: 1,
    play: vi.fn(async () => { Object.assign(video, { paused: false }); }),
    pause: vi.fn(() => { Object.assign(video, { paused: true }); }),
    load: vi.fn(() => { Object.assign(video, { readyState: 1, seeking: false }); time = 0; }),
  };
  const player = new StagePlayback(video, (phase) => phases.push(phase), () => now);
  const cue = { id: 'cue-1', source: 'guest', playing: true, position: 0, startedAt: 0, volume: 0.75, muted: false };
  const advance = (milliseconds: number, mediaSeconds = 0) => { now += milliseconds; time += mediaSeconds; player.tick(); };
  return { video, player, phases, seeks, cue, advance };
}

describe('stage video transport without seek storms', () => {
  it('plays continuously for two minutes without seeking', () => {
    const f = fixture();
    f.player.configure(f.cue, true); f.player.loaded();
    for (let i = 0; i < 240; i++) f.advance(500, 0.5);
    expect(f.seeks).toEqual([]);
    expect(f.video.load).not.toHaveBeenCalled();
    expect(f.phases.at(-1)).toBe('playing');
  });
  it('uses bounded speed correction, not repeated seeks, when behind', () => {
    const f = fixture();
    f.player.configure(f.cue, true); f.player.loaded();
    for (let i = 0; i < 30; i++) f.advance(1000, 0.8);
    expect(f.seeks).toEqual([]);
    expect(f.video.playbackRate).toBe(1.03);
    f.player.configure({ ...f.cue, volume: 0.25 }, true);
    expect(f.seeks).toEqual([]);
  });
  it('seeks only once for a late join, including loadeddata after seek', () => {
    const f = fixture();
    f.advance(20000);
    f.player.configure(f.cue, true); f.player.loaded(); f.player.loaded();
    f.advance(500, 0.5);
    expect(f.seeks).toEqual([20]);
  });
  it('detects a stuck seek and caps decoder recovery at two reloads', () => {
    const f = fixture();
    f.player.configure(f.cue, true); f.player.loaded();
    Object.assign(f.video, { seeking: true, readyState: 1 });
    f.advance(3000);
    expect(f.phases.at(-1)).toBe('waiting');
    f.advance(7000); f.advance(10000); f.advance(10000);
    expect(f.video.load).toHaveBeenCalledTimes(2);
    expect(f.phases.at(-1)).toBe('error');
    f.advance(10000);
    expect(f.video.load).toHaveBeenCalledTimes(2);
  });
  it('does not retry forever when autoplay needs user consent', async () => {
    const f = fixture();
    const denied = new Error('gesture required'); denied.name = 'NotAllowedError';
    vi.mocked(f.video.play).mockRejectedValueOnce(denied);
    f.player.configure(f.cue, false); f.player.loaded();
    await Promise.resolve(); await Promise.resolve();
    f.advance(30000);
    expect(f.phases.at(-1)).toBe('blocked');
    expect(f.video.load).not.toHaveBeenCalled();
    f.player.unlock(); await Promise.resolve();
    expect(f.video.play).toHaveBeenCalledTimes(2);
  });
  it('pause and disposal stop playback and no watchdog reload follows', () => {
    const f = fixture();
    f.player.configure(f.cue, true); f.player.loaded(); f.advance(2000, 2);
    f.player.configure({ ...f.cue, playing: false, position: 2, startedAt: null }, true);
    f.advance(30000);
    expect(f.video.paused).toBe(true);
    expect(f.phases.at(-1)).toBe('ready');
    f.player.dispose(); f.advance(30000);
    expect(f.video.load).not.toHaveBeenCalled();
  });
  it('resumes from the shared position after a single decoder recovery', () => {
    const f = fixture();
    f.player.configure(f.cue, true); f.player.loaded();
    f.advance(10000);
    expect(f.video.load).toHaveBeenCalledTimes(1);
    Object.assign(f.video, { readyState: 4 });
    f.player.loaded(); f.player.loaded();
    expect(f.seeks).toEqual([10]);
    for (let i = 0; i < 40; i++) f.advance(500, 0.5);
    expect(f.video.load).toHaveBeenCalledTimes(1);
    expect(f.phases.at(-1)).toBe('playing');
  });
  it('does not let a rejected, obsolete play promise block a new command', async () => {
    const f = fixture();
    let reject!: (error: Error) => void;
    vi.mocked(f.video.play).mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
    f.player.configure(f.cue, true); f.player.loaded();
    f.player.configure({ ...f.cue, playing: false, startedAt: null }, true);
    const denied = new Error('old play'); denied.name = 'NotAllowedError';
    reject(denied); await Promise.resolve(); await Promise.resolve();
    expect(f.phases.at(-1)).toBe('ready');
    expect(f.video.load).not.toHaveBeenCalled();
  });
});
