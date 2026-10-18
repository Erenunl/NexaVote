import { mediaPosition, type StageMedia } from './stageMedia';

export type PlaybackPhase = 'ready' | 'playing' | 'waiting' | 'recovering' | 'blocked' | 'ended' | 'error';
export type PlaybackVideo = Pick<HTMLVideoElement, 'currentTime' | 'duration' | 'readyState' | 'paused' | 'seeking' | 'ended' | 'volume' | 'muted' | 'playbackRate' | 'play' | 'pause' | 'load'>;

/** Only transport commands and explicit recovery may seek. Polling, camera,
 * volume and palette updates must never interrupt the decoder with a seek. */
export class StagePlayback {
  private media: StageMedia | null = null;
  private command = '';
  private pendingCommand = true;
  private playPending = false;
  private blocked = false;
  private stopped = false;
  private lastTime = 0;
  private lastProgress = 0;
  private lastPlayAttempt = -Infinity;
  private recoveries = 0;
  private phase: PlaybackPhase = 'ready';
  private generation = 0;
  private loading = true;

  constructor(private video: PlaybackVideo, private report: (phase: PlaybackPhase) => void, private now = Date.now) {}

  configure(media: StageMedia, soundAllowed: boolean) {
    if (this.stopped) return;
    this.media = media;
    this.video.volume = media.volume;
    this.video.muted = media.muted || !soundAllowed;
    const command = JSON.stringify([media.id, media.playing, media.position, media.startedAt]);
    if (command !== this.command) {
      this.generation++;
      this.playPending = false;
      this.command = command;
      this.pendingCommand = true;
      this.recoveries = 0;
      this.lastTime = this.video.currentTime;
      this.lastProgress = this.now();
      this.video.playbackRate = 1;
    }
    this.tick();
  }

  prepare() { this.loading = true; this.lastProgress = this.now(); }

  loaded() {
    if (this.stopped) return;
    // loadeddata also fires after seeks; never re-arm the same command here.
    if (this.loading) { this.loading = false; this.lastProgress = this.now(); }
    this.tick();
  }

  unlock() {
    this.blocked = false;
    this.lastProgress = this.now();
    this.lastPlayAttempt = -Infinity;
    if (this.media?.playing) this.play();
    this.tick();
  }

  failed() { this.setPhase('error'); }

  tick() {
    if (this.stopped || !this.media || this.phase === 'error') return;
    const video = this.video;
    const now = this.now();
    const desired = mediaPosition(this.media, video.duration, now);
    const atEnd = Number.isFinite(video.duration) && desired >= video.duration - 0.1;
    if (!this.media.playing || atEnd) {
      if (!video.paused) video.pause();
      video.playbackRate = 1;
      if (this.pendingCommand && !this.loading && !video.seeking && video.readyState >= 2) {
        this.pendingCommand = false;
        if (Math.abs(video.currentTime - desired) > 0.15) video.currentTime = desired;
      }
      this.lastProgress = now;
      this.setPhase(atEnd ? 'ended' : 'ready');
      return;
    }
    if (this.blocked) { this.setPhase('blocked'); return; }
    if (Math.abs(video.currentTime - this.lastTime) > 0.03 && !video.seeking && video.readyState >= 2) {
      this.lastProgress = now;
      this.lastTime = video.currentTime;
    }
    if (!this.loading && !video.seeking && video.readyState >= 2) {
      if (this.pendingCommand) {
        this.pendingCommand = false;
        this.lastProgress = now;
        this.lastTime = desired;
        if (Math.abs(video.currentTime - desired) > 0.35) {
          video.currentTime = desired;
          this.setPhase('waiting');
          return;
        }
      }
      const drift = desired - video.currentTime;
      video.playbackRate = Math.abs(drift) < 0.2 ? 1 : Math.max(0.97, Math.min(1.03, 1 + drift * 0.015));
      if (video.paused && now - this.lastPlayAttempt >= 2000) this.play();
    }
    const stalledFor = now - this.lastProgress;
    if (stalledFor >= 10000) {
      if (this.recoveries >= 2) { video.pause(); this.setPhase('error'); return; }
      this.recoveries++;
      this.generation++;
      this.playPending = false;
      this.loading = true;
      this.pendingCommand = true;
      this.lastProgress = now;
      this.lastPlayAttempt = -Infinity;
      video.pause();
      video.playbackRate = 1;
      video.load(); // Same buffered Blob URL, no network request or new cue.
      this.setPhase('recovering');
    } else if (this.loading || video.seeking || video.readyState < 2 || stalledFor > 2000 || video.paused) {
      this.setPhase(this.phase === 'recovering' ? 'recovering' : 'waiting');
    } else this.setPhase('playing');
  }

  dispose() {
    this.stopped = true;
    this.generation++;
    this.video.pause();
    this.video.playbackRate = 1;
  }

  private play() {
    if (this.playPending || this.stopped) return;
    const generation = this.generation;
    this.playPending = true;
    this.lastPlayAttempt = this.now();
    void this.video.play().catch((error: unknown) => {
      if (this.stopped || generation !== this.generation) return;
      if (error instanceof Error && error.name === 'NotAllowedError') { this.blocked = true; this.setPhase('blocked'); }
    }).finally(() => { if (generation === this.generation) this.playPending = false; });
  }

  private setPhase(phase: PlaybackPhase) {
    if (phase === this.phase) return;
    this.phase = phase;
    this.report(phase);
  }
}
