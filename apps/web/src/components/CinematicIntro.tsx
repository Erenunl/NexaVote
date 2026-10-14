import { FastForward, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

const INTRO_SESSION_KEY = 'nexavision.cinematicIntroCompleted';
const MINIMUM_LOGO_TIME = 1200;
const LOGO_FADE_TIME = 800;
const VIDEO_FADE_TIME = 800;
const LOGIN_REVEAL_TIME = 1000;
const LOAD_TIMEOUT = 8000;

const introVideoUrl = `${import.meta.env.BASE_URL}results-opening.mp4`;
const introLogoUrl = `${import.meta.env.BASE_URL}nexavision-lyon-2026-logo.png`;

type IntroPhase = 'loading' | 'logoOut' | 'video' | 'videoOut' | 'reveal';

export function shouldPlayCinematicIntro() {
  return sessionStorage.getItem(INTRO_SESSION_KEY) !== 'true';
}

export function CinematicIntro({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<IntroPhase>('loading');
  const [videoReady, setVideoReady] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mountedAt = useRef(performance.now());
  const startRequested = useRef(false);
  const finishRequested = useRef(false);
  const loadTimeout = useRef<number | null>(null);
  const timers = useRef<number[]>([]);

  const schedule = useCallback((callback: () => void, delay: number) => {
    const timer = window.setTimeout(callback, delay);
    timers.current.push(timer);
    return timer;
  }, []);

  const finishIntro = useCallback(() => {
    if (finishRequested.current) return;
    finishRequested.current = true;
    videoRef.current?.pause();
    setPhase('videoOut');
    schedule(() => {
      sessionStorage.setItem(INTRO_SESSION_KEY, 'true');
      setPhase('reveal');
      schedule(onComplete, LOGIN_REVEAL_TIME);
    }, VIDEO_FADE_TIME);
  }, [onComplete, schedule]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      sessionStorage.setItem(INTRO_SESSION_KEY, 'true');
      onComplete();
      return;
    }
    loadTimeout.current = schedule(finishIntro, LOAD_TIMEOUT);
    return () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
      videoRef.current?.pause();
    };
  }, [finishIntro, onComplete, schedule]);

  useEffect(() => {
    if (!videoReady || startRequested.current || finishRequested.current) return;
    startRequested.current = true;
    if (loadTimeout.current !== null) window.clearTimeout(loadTimeout.current);
    const logoTimeRemaining = Math.max(0, MINIMUM_LOGO_TIME - (performance.now() - mountedAt.current));
    schedule(() => {
      setPhase('logoOut');
      schedule(() => {
        const video = videoRef.current;
        if (!video) {
          finishIntro();
          return;
        }
        video.currentTime = 0;
        video.muted = true;
        void video.play().then(() => setPhase('video')).catch(finishIntro);
      }, LOGO_FADE_TIME);
    }, logoTimeRemaining);
  }, [finishIntro, schedule, videoReady]);

  const toggleSound = async () => {
    const video = videoRef.current;
    if (!video) return;
    const nextValue = !soundEnabled;
    video.muted = !nextValue;
    setSoundEnabled(nextValue);
    if (video.paused) await video.play().catch(() => undefined);
  };

  const logoVisible = phase === 'loading';
  const videoVisible = phase === 'video';
  const controlsVisible = phase !== 'videoOut' && phase !== 'reveal';

  return (
    <div className={`fixed inset-0 z-[200] overflow-hidden bg-black transition-opacity duration-1000 ${phase === 'reveal' ? 'pointer-events-none opacity-0' : 'opacity-100'}`} role="dialog" aria-label="Nexavision açılış videosu">
      <video
        ref={videoRef}
        className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-[800ms] ${videoVisible ? 'opacity-100' : 'opacity-0'}`}
        src={introVideoUrl}
        autoPlay={false}
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        onLoadedData={() => setVideoReady(true)}
        onCanPlay={() => setVideoReady(true)}
        onEnded={finishIntro}
        onError={finishIntro}
      />

      <div className={`pointer-events-none absolute inset-0 grid place-items-center px-6 transition-opacity duration-[800ms] ${logoVisible ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true">
        <img className="h-auto w-[min(88vw,1100px)] object-contain" src={introLogoUrl} alt="" />
      </div>

      <div className={`absolute inset-x-0 top-0 flex items-center justify-between p-4 transition-opacity duration-300 sm:p-6 ${controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
        {phase === 'video' ? <button className="rounded-full border border-white/25 bg-black/35 px-4 py-2 text-xs font-bold text-white backdrop-blur-xl transition hover:border-white/50 hover:bg-black/55" onClick={toggleSound}>{soundEnabled ? <Volume2 className="mr-2 inline h-4 w-4" /> : <VolumeX className="mr-2 inline h-4 w-4" />}{soundEnabled ? 'Sesi kapat' : 'Sesi aç'}</button> : <span />}
        <button className="rounded-full border border-white/25 bg-black/35 px-4 py-2 text-xs font-bold text-white backdrop-blur-xl transition hover:border-white/50 hover:bg-black/55" onClick={finishIntro}><FastForward className="mr-2 inline h-4 w-4" />Açılışı geç</button>
      </div>
    </div>
  );
}
