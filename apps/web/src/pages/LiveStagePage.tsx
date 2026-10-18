import { Radio, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { StageBroadcastVideo } from '../components/StageBroadcastVideo';
import { defaultBroadcastState, LiveStageView, normalizeLiveStageState, type LiveStageBroadcastState } from './AdminLiveStage';

type PublicStageResponse = {
  edition: string;
  state: unknown;
  revision: number;
  updatedAt: string | null;
};

export function LiveStagePage() {
  const [stage, setStage] = useState<LiveStageBroadcastState>({ ...defaultBroadcastState, controls: { ...defaultBroadcastState.controls } });
  const [edition, setEdition] = useState('Nexavision');
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const revisionRef = useRef('');

  useEffect(() => {
    document.title = 'Nexavision Live Stage';
    let cancelled = false;
    let inFlight = false;
    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await api<PublicStageResponse>('/api/public/live-stage');
        if (cancelled) return;
        const version = `${response.edition}:${response.revision}`;
        if (version !== revisionRef.current) {
          revisionRef.current = version;
          setStage(normalizeLiveStageState(response.state));
        }
        setEdition(response.edition);
        setConnected(true);
        setReady(true);
      } catch {
        if (!cancelled) {
          setConnected(false);
          setReady(true);
        }
      } finally {
        inFlight = false;
      }
    };
    void load();
    const timer = window.setInterval(load, 600);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  if (!ready) return <main className="live-stage-public-shell live-stage-public-loading"><Radio /><strong>Canlı sahneye bağlanılıyor</strong><span>3D yayın hazırlanıyor…</span></main>;

  return <main className="live-stage-public-shell">
    <LiveStageView state={stage} videoElement={video} videoReady={Boolean(video)} publicView>
      <StageBroadcastVideo media={stage.media} onVideo={setVideo} />
    </LiveStageView>
    <div className={`live-stage-public-status ${connected ? 'is-connected' : 'is-disconnected'}`} role="status">
      {connected ? <Wifi /> : <WifiOff />}
      <span><strong>{connected ? 'CANLI' : 'BAĞLANTI YENİLENİYOR'}</strong><small>{edition} · Reji görüntüsü</small></span>
    </div>
  </main>;
}

