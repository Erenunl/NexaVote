import { useEffect, useRef, useState } from 'react';
import { stageVideos, type StageMedia } from '../lib/stageMedia';
import { StagePlayback, type PlaybackPhase } from '../lib/stagePlayback';

export type StageVideoStatus = { progress: number; ready: boolean; blocked: boolean; error: string | null; ended?: boolean; phase?: PlaybackPhase };

export function StageBroadcastVideo({ media, onVideo, onStatus, audible = true }: {
  media: StageMedia | null;
  onVideo: (video: HTMLVideoElement | null) => void;
  onStatus?: (status: StageVideoStatus) => void;
  audible?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const transport = useRef<StagePlayback | null>(null);
  const [status, setStatus] = useState<StageVideoStatus>({ progress: 0, ready: false, blocked: false, error: null });
  const [retry, setRetry] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const latest = useRef({ media, audible, soundEnabled, onVideo, onStatus });
  latest.current = { media, audible, soundEnabled, onVideo, onStatus };
  const source = media?.source;
  const cueId = media?.id;

  useEffect(() => { latest.current.onStatus?.(status); }, [status]);
  useEffect(() => {
    const video = ref.current;
    const entry = stageVideos.find((item) => item.id === source);
    if (!video || !entry || !cueId) return;
    const controller = new AbortController();
    let disposed = false;
    let objectUrl: string | null = null;
    let timer: number | undefined;
    let lastPercent = -1;
    setStatus({ progress: 0, ready: false, blocked: false, error: null });
    latest.current.onVideo(null);
    const player = new StagePlayback(video, (phase) => {
      if (!disposed) setStatus((current) => ({ ...current, phase, blocked: phase === 'blocked', ended: phase === 'ended',
        error: phase === 'error' ? 'Video oynatıcısı yanıt vermiyor. Yeniden deneyin.' : null }));
    });
    transport.current = player;
    const loaded = () => {
      if (disposed) return;
      setStatus((current) => ({ ...current, progress: 100, ready: true }));
      latest.current.onVideo(video);
      player.loaded();
    };
    const failed = () => { if (!disposed && video.error?.code !== 1) player.failed(); };
    video.addEventListener('loadeddata', loaded);
    video.addEventListener('error', failed);
    video.pause();
    const load = async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}${entry.file}`, { signal: controller.signal });
        if (!response.ok || !response.body) throw new Error('Video yüklenemedi. Yeniden deneyin.');
        const total = Number(response.headers.get('content-length'));
        const reader = response.body.getReader();
        const chunks: Uint8Array<ArrayBuffer>[] = [];
        let received = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          received += value.byteLength;
          chunks.push(new Uint8Array(value));
          const progress = total > 0 ? Math.min(99, Math.floor(received / total * 100)) : 0;
          if (!disposed && progress !== lastPercent) {
            lastPercent = progress;
            setStatus((current) => ({ ...current, progress }));
          }
        }
        if (disposed) return;
        objectUrl = URL.createObjectURL(new Blob(chunks, { type: 'video/mp4' }));
        player.prepare();
        video.src = objectUrl;
        video.load();
        if (latest.current.media) player.configure(latest.current.media, latest.current.audible && latest.current.soundEnabled);
        timer = window.setInterval(() => player.tick(), 500);
      } catch (error) {
        if (!disposed) setStatus((current) => ({ ...current, error: error instanceof Error ? error.message : 'Video yüklenemedi.' }));
      }
    };
    void load();
    return () => {
      disposed = true;
      controller.abort();
      window.clearInterval(timer);
      video.removeEventListener('loadeddata', loaded);
      video.removeEventListener('error', failed);
      player.dispose();
      transport.current = null;
      video.removeAttribute('src');
      video.load();
      latest.current.onVideo(null);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source, cueId, retry]);

  useEffect(() => {
    if (media) transport.current?.configure(media, audible && soundEnabled);
  }, [media, audible, soundEnabled]);

  if (!media) return null;
  const label = !status.ready ? `Video ön yükleniyor · %${Math.round(status.progress)}`
    : status.phase === 'recovering' ? 'Oynatıcı toparlanıyor…'
      : status.phase === 'waiting' ? 'Video karesi bekleniyor…'
        : status.blocked ? 'Oynatma izni gerekiyor'
          : status.ended ? 'Video sona erdi'
            : status.phase === 'playing' ? 'Video yayında' : 'Video hazır · Reji bekleniyor';
  return <div className="stage-media-status" role="status">
    <video ref={ref} className="stage-video-element" playsInline preload="auto" muted={!soundEnabled || !audible || media.muted} />
    <span>{status.error || label}</span>
    {status.error && <button type="button" onClick={() => setRetry((value) => value + 1)}>Yeniden dene</button>}
    {status.ready && audible && (!soundEnabled || status.blocked) && <button type="button" onClick={() => {
      setSoundEnabled(true);
      transport.current?.configure(media, true);
      transport.current?.unlock();
    }}>Sesi / oynatmayı etkinleştir</button>}
  </div>;
}
