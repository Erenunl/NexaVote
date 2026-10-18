import { useEffect, useRef, useState } from 'react';
import { mediaPosition, stageVideos, type StageMedia } from '../lib/stageMedia';

export type StageVideoStatus = { progress: number; ready: boolean; blocked: boolean; error: string | null; ended?: boolean };

// Download completely into browser memory before playback. No upload or Downloads-folder write.
export function StageBroadcastVideo({ media, onVideo, onStatus, audible = true }: {
  media: StageMedia | null;
  onVideo: (video: HTMLVideoElement | null) => void;
  onStatus?: (status: StageVideoStatus) => void;
  audible?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<StageVideoStatus>({ progress: 0, ready: false, blocked: false, error: null });
  const [retry, setRetry] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const callbacks = useRef({ onVideo, onStatus });
  callbacks.current = { onVideo, onStatus };
  const source = media?.source;
  const cueId = media?.id;

  useEffect(() => { callbacks.current.onStatus?.(status); }, [status]);
  useEffect(() => {
    const video = ref.current;
    const entry = stageVideos.find((item) => item.id === source);
    if (!video || !entry || !cueId) return;
    const controller = new AbortController();
    let disposed = false;
    let objectUrl: string | null = null;
    setStatus({ progress: 0, ready: false, blocked: false, error: null });
    callbacks.current.onVideo(null);
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
          if (!disposed) setStatus((current) => ({ ...current, progress: total > 0 ? Math.min(99, received / total * 100) : 0 }));
        }
        if (disposed) return;
        objectUrl = URL.createObjectURL(new Blob(chunks, { type: 'video/mp4' }));
        video.src = objectUrl;
        video.load();
      } catch (error) {
        if (!disposed) setStatus((current) => ({ ...current, error: error instanceof Error ? error.message : 'Video yüklenemedi.' }));
      }
    };
    void load();
    return () => {
      disposed = true;
      controller.abort();
      video.pause();
      video.removeAttribute('src');
      video.load();
      callbacks.current.onVideo(null);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source, cueId, retry]);

  useEffect(() => {
    const video = ref.current;
    if (!video || !media || !status.ready) return;
    const synchronize = () => {
      video.volume = media.volume;
      video.muted = !audible || media.muted || !soundEnabled;
      const target = mediaPosition(media, video.duration);
      const ended = Number.isFinite(video.duration) && target >= video.duration - 0.1;
      setStatus((current) => Boolean(current.ended) === ended ? current : { ...current, ended });
      // Avoid repeated seeks during decode/buffering: those can perpetuate a stall.
      if (!video.seeking && Math.abs(video.currentTime - target) > (media.playing ? 2.5 : 0.1)) video.currentTime = target;
      if (media.playing && target < video.duration - 0.1) {
        if (video.paused) void video.play().catch(() => setStatus((current) => ({ ...current, blocked: true })));
      } else video.pause();
    };
    synchronize();
    const timer = window.setInterval(synchronize, 1500);
    return () => window.clearInterval(timer);
  }, [media, status.ready, audible, soundEnabled]);

  if (!media) return null;
  return <div className="stage-media-status" role="status">
    <video ref={ref} className="stage-video-element" playsInline preload="auto" muted={!soundEnabled || !audible || media.muted}
      onLoadedData={() => { setStatus({ progress: 100, ready: true, blocked: false, error: null }); callbacks.current.onVideo(ref.current); }}
      onError={() => setStatus((current) => ({ ...current, ready: false, error: 'Video bu tarayıcıda çözülemedi. Yeniden deneyin.' }))} />
    <span>{status.error || (status.ready ? (status.ended ? 'Video sona erdi' : media.playing ? 'Video yayında' : 'Video hazır · Reji bekleniyor') : `Video ön yükleniyor · %${Math.round(status.progress)}`)}</span>
    {status.error && <button type="button" onClick={() => setRetry((value) => value + 1)}>Yeniden yükle</button>}
    {status.ready && audible && (!soundEnabled || status.blocked) && <button type="button" onClick={() => {
      setSoundEnabled(true);
      const video = ref.current;
      if (video && media.playing) {
        video.muted = media.muted;
        void video.play().then(() => setStatus((current) => ({ ...current, blocked: false }))).catch(() => setStatus((current) => ({ ...current, blocked: true })));
      }
    }}>Sesi / oynatmayı etkinleştir</button>}
  </div>;
}
