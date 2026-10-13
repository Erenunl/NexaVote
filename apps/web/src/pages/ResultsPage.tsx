import { Expand, LockKeyhole, Radio, Sparkles, Trophy } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';

type Result = { countryId: string; country: string; flag: string; totalPoints: number };
type RevealScore = { countryId: string; country: string; flag: string; points: number };
type JuryReveal = {
  revealOrder: number;
  revealedAt: string;
  juryCountryId: string;
  juryCountry: string;
  juryFlag: string;
  scores: RevealScore[];
};
type ResultsResponse = {
  edition: string;
  resultsOpenedAt: string | null;
  juriesRevealed: number;
  juriesSubmitted: number;
  scoreboard: Result[];
  reveals: JuryReveal[];
};
type ActiveReveal = {
  reveal: JuryReveal;
  stage: 'intro' | 'points' | 'complete';
  score?: RevealScore;
  scoreIndex?: number;
};

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
const REVEAL_TIMING = {
  intro: 2800,
  standardPoint: 2000,
  highPoint: 2800,
  complete: 1800,
} as const;
const OPENING_TIMING = {
  audioStartSeconds: 4,
  titleAt: 7000,
  titleEndAt: 14000,
  videoAt: 14000,
  endAt: 26000,
} as const;
const openingAudioUrl = `${import.meta.env.BASE_URL}results-opening.mp3`;
const openingVideoUrl = `${import.meta.env.BASE_URL}results-opening.mp4`;

function addScore(scoreboard: Result[], score: RevealScore): Result[] {
  return scoreboard
    .map((item) => item.countryId === score.countryId ? { ...item, totalPoints: item.totalPoints + score.points } : item)
    .sort((a, b) => b.totalPoints - a.totalPoints || a.country.localeCompare(b.country, 'tr'));
}

export function ResultsPage() {
  const [scoreboard, setScoreboard] = useState<Result[]>([]);
  const [meta, setMeta] = useState<Pick<ResultsResponse, 'edition' | 'juriesRevealed' | 'juriesSubmitted'> | null>(null);
  const [hidden, setHidden] = useState(true);
  const [activeReveal, setActiveReveal] = useState<ActiveReveal | null>(null);
  const [openingStartedAt, setOpeningStartedAt] = useState<number | null>(null);
  const [openingElapsed, setOpeningElapsed] = useState<number | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const seenRevealOrder = useRef<number | null>(null);
  const revealQueue = useRef<JuryReveal[]>([]);
  const processingQueue = useRef(false);
  const mounted = useRef(true);
  const latestServerScoreboard = useRef<Result[]>([]);
  const openingActive = useRef(false);
  const openingRunId = useRef<string | null>(null);
  const audioAttempted = useRef(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const playRevealQueue = useCallback(async () => {
    if (processingQueue.current || openingActive.current) return;
    processingQueue.current = true;
    while (mounted.current && revealQueue.current.length > 0) {
      const reveal = revealQueue.current.shift();
      if (!reveal) break;
      setActiveReveal({ reveal, stage: 'intro' });
      await wait(REVEAL_TIMING.intro);
      const scores = [...reveal.scores].sort((a, b) => a.points - b.points);
      for (let index = 0; index < scores.length && mounted.current; index += 1) {
        const score = scores[index];
        if (!score) continue;
        setActiveReveal({ reveal, stage: 'points', score, scoreIndex: index + 1 });
        setScoreboard((current) => addScore(current, score));
        await wait(score.points >= 10 ? REVEAL_TIMING.highPoint : REVEAL_TIMING.standardPoint);
      }
      if (!mounted.current) break;
      setActiveReveal({ reveal, stage: 'complete' });
      await wait(REVEAL_TIMING.complete);
      setActiveReveal(null);
    }
    processingQueue.current = false;
    if (mounted.current) setScoreboard(latestServerScoreboard.current);
  }, []);

  const beginOpening = useCallback((resultsOpenedAt: string | null) => {
    if (!resultsOpenedAt || openingRunId.current === resultsOpenedAt) return;
    const startedAt = Date.parse(resultsOpenedAt);
    const elapsed = Date.now() - startedAt;
    openingRunId.current = resultsOpenedAt;
    if (!Number.isFinite(startedAt) || elapsed >= OPENING_TIMING.endAt) return;
    openingActive.current = true;
    audioAttempted.current = false;
    setOpeningStartedAt(startedAt);
    setOpeningElapsed(Math.max(0, elapsed));
  }, []);

  const refreshResults = useCallback(async () => {
    try {
      const data = await api<ResultsResponse>('/api/public/results');
      if (!mounted.current) return;
      setHidden(false);
      setMeta({ edition: data.edition, juriesRevealed: data.juriesRevealed, juriesSubmitted: data.juriesSubmitted });
      latestServerScoreboard.current = data.scoreboard;
      beginOpening(data.resultsOpenedAt);
      const newestOrder = data.reveals.at(-1)?.revealOrder ?? 0;
      if (seenRevealOrder.current === null) {
        seenRevealOrder.current = newestOrder;
        setScoreboard(data.scoreboard);
        return;
      }
      const unseen = data.reveals.filter((reveal) => reveal.revealOrder > (seenRevealOrder.current ?? 0));
      if (unseen.length > 0) {
        seenRevealOrder.current = newestOrder;
        revealQueue.current.push(...unseen);
        void playRevealQueue();
      } else if (!processingQueue.current) {
        setScoreboard(data.scoreboard);
      }
    } catch (caught) {
      const error = caught as Error & { code?: string };
      if (error.code === 'RESULTS_HIDDEN') {
        setHidden(true);
        seenRevealOrder.current = null;
        openingRunId.current = null;
        openingActive.current = false;
        setOpeningStartedAt(null);
        setOpeningElapsed(null);
        audioRef.current?.pause();
        videoRef.current?.pause();
      }
    }
  }, [beginOpening, playRevealQueue]);

  const prepareAudio = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      audio.muted = true;
      await audio.play();
      audio.pause();
      audio.currentTime = OPENING_TIMING.audioStartSeconds;
      audio.muted = false;
      setAudioReady(true);
      setAudioBlocked(false);
    } catch {
      audio.muted = false;
      setAudioBlocked(true);
    }
  }, []);

  const enableOpeningAudio = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || openingStartedAt === null) return;
    try {
      const elapsed = Math.max(0, Date.now() - openingStartedAt);
      audio.currentTime = OPENING_TIMING.audioStartSeconds + elapsed / 1000;
      audio.muted = false;
      await audio.play();
      setAudioReady(true);
      setAudioBlocked(false);
    } catch {
      setAudioBlocked(true);
    }
  }, [openingStartedAt]);

  useEffect(() => {
    if (openingStartedAt === null) return;
    let finished = false;
    const finishOpening = () => {
      if (finished) return;
      finished = true;
      openingActive.current = false;
      audioRef.current?.pause();
      videoRef.current?.pause();
      setOpeningElapsed(null);
      setOpeningStartedAt(null);
      void playRevealQueue();
    };
    const synchronize = () => {
      const elapsed = Math.max(0, Date.now() - openingStartedAt);
      if (elapsed >= OPENING_TIMING.endAt) {
        finishOpening();
        return;
      }
      setOpeningElapsed(elapsed);

      const audio = audioRef.current;
      if (audio && audio.readyState > 0) {
        const targetTime = OPENING_TIMING.audioStartSeconds + elapsed / 1000;
        if (Math.abs(audio.currentTime - targetTime) > 0.45) audio.currentTime = targetTime;
        if (audio.paused && !audioAttempted.current) {
          audioAttempted.current = true;
          void audio.play().then(() => {
            setAudioReady(true);
            setAudioBlocked(false);
          }).catch(() => setAudioBlocked(true));
        }
      }

      const video = videoRef.current;
      if (video && videoReady && elapsed >= OPENING_TIMING.videoAt) {
        const targetTime = (elapsed - OPENING_TIMING.videoAt) / 1000;
        if (Math.abs(video.currentTime - targetTime) > 0.45) video.currentTime = targetTime;
        if (video.paused) void video.play().catch(() => undefined);
      }
    };
    synchronize();
    const timer = window.setInterval(synchronize, 100);
    return () => window.clearInterval(timer);
  }, [openingStartedAt, playRevealQueue, videoReady]);

  useEffect(() => {
    mounted.current = true;
    void refreshResults();
    const timer = window.setInterval(refreshResults, 1500);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
    };
  }, [refreshResults]);

  const maxPoints = useMemo(() => Math.max(...scoreboard.map((item) => item.totalPoints), 1), [scoreboard]);
  const leader = (scoreboard[0]?.totalPoints ?? 0) > 0 ? scoreboard[0] : undefined;
  const highlightedCountryId = activeReveal?.stage === 'points' ? activeReveal.score?.countryId : undefined;
  const openingStage = openingElapsed === null
    ? null
    : openingElapsed < OPENING_TIMING.titleAt
      ? 'black'
      : openingElapsed < OPENING_TIMING.videoAt
        ? 'title'
        : 'video';
  const openingAudio = <audio key="results-opening-audio" ref={audioRef} preload="auto" src={openingAudioUrl} />;

  if (hidden) return <>{openingAudio}<section className="mx-auto grid min-h-[75vh] max-w-3xl place-items-center px-5 py-16"><div className="panel w-full overflow-hidden p-10 text-center"><div className="stage-orbit mx-auto grid h-28 w-28 place-items-center"><span className="relative z-10 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-pink to-orange shadow-lg shadow-pink/30"><LockKeyhole /></span></div><p className="eyebrow mt-7">Büyük açıklama yaklaşıyor</p><h1 className="mt-3 font-display text-4xl font-black uppercase">Sonuçlar henüz gizli</h1><p className="mx-auto mt-4 max-w-md leading-7 text-pink-50/60">Organizatör sonuç ekranını açtığında bu sayfa kendiliğinden canlı yayına geçecek. Yenilemeniz gerekmez.</p><button className="btn-primary mx-auto mt-6" onClick={prepareAudio}>{audioReady ? 'Yayın sesi hazır' : 'Yayın sesini hazırla'}</button><div className="mt-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-softpink"><span className="status-dot animate-pulseSoft bg-softpink" /> Canlı bağlantı bekleniyor</div></div></section></>;

  return (
    <>{openingAudio}<section className="mx-auto min-h-[75vh] max-w-7xl px-5 py-14 lg:px-8">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div><div className="broadcast-chip mb-4"><Radio className="h-3.5 w-3.5 text-orange" /> Canlı · Otomatik güncelleniyor</div><p className="eyebrow">Resmî sonuçlar</p><h1 className="mt-2 font-display text-5xl font-black uppercase tracking-[-.04em] sm:text-7xl">{meta?.edition || 'Nexavision'}</h1><p className="mt-3 text-pink-50/60">{meta?.juriesSubmitted} jüri oyununun {meta?.juriesRevealed} tanesi açıklandı</p></div>
        <button className="btn-secondary" onClick={() => document.documentElement.requestFullscreen?.()}><Expand className="h-4 w-4" />Sunum modu</button>
      </div>
      <div className="mt-10 grid gap-5 xl:grid-cols-[1fr_280px]">
        <div className="panel overflow-hidden p-3 sm:p-5">
          <div className="mb-3 flex items-center justify-between px-2 text-[10px] font-black uppercase tracking-[.2em] text-pink-100/45"><span>Sıra · Ülke</span><span>Toplam puan</span></div>
          <div className="space-y-2">{scoreboard.map((result, index) => (
            <div key={result.countryId} className={`scoreboard-row reveal-row ${index === 0 && result.totalPoints > 0 ? 'scoreboard-row-winner' : ''} ${highlightedCountryId === result.countryId ? 'scoreboard-row-highlighted' : ''}`} style={{ animationDelay: `${index * 35}ms` }}>
              <span className="relative z-10 grid h-10 w-10 place-items-center rounded-lg border border-white/25 bg-purple/35 font-display text-lg font-black sm:h-11 sm:w-11">{index + 1}</span>
              <div className="relative z-10 min-w-0"><div className="flex items-center gap-3"><span className="text-2xl sm:text-3xl">{result.flag}</span><span className="truncate font-display text-base font-bold uppercase sm:text-xl">{result.country}</span>{index === 0 && <Trophy className="hidden h-5 w-5 text-white sm:block" />}</div><div className="mt-1.5 hidden h-1 overflow-hidden rounded-full bg-purple/25 sm:block"><div className="h-full bg-white/70 transition-all duration-500" style={{ width: `${Math.max(6, result.totalPoints / maxPoints * 100)}%` }} /></div></div>
              <span className="relative z-10 font-display text-2xl font-black tabular-nums sm:text-3xl">{result.totalPoints}<small className="ml-1 text-[10px] font-bold uppercase text-white/60">puan</small></span>
            </div>
          ))}</div>
          {scoreboard.length === 0 && <div className="rounded-2xl border border-white/15 bg-white/[.07] p-10 text-center text-pink-50/55">Skor tablosu açıklanacak ilk puanları bekliyor.</div>}
        </div>
        <aside className="panel h-fit overflow-hidden p-6"><span className="text-5xl">{leader?.flag || '✨'}</span><p className="eyebrow mt-6">Şu anki lider</p><h2 className="mt-2 font-display text-3xl font-black uppercase">{leader?.country || 'Oylar bekleniyor'}</h2><p className="mt-2 text-pink-50/55">{leader ? `Skor tablosunda ${leader.totalPoints} puan` : 'İlk jüri açıklamasıyla yarış başlayacak.'}</p><div className="mt-6 h-1.5 rounded-full bg-gradient-to-r from-orange via-pink to-electric" /></aside>
      </div>

      {activeReveal?.stage === 'intro' && <div className="jury-reveal-backdrop fixed inset-0 z-50 grid place-items-center p-5" role="status" aria-live="assertive"><div className="jury-reveal-intro text-center"><span className="text-7xl sm:text-8xl">{activeReveal.reveal.juryFlag}</span><p className="eyebrow mt-8">Sıradaki jüri</p><h2 className="mt-3 font-display text-5xl font-black uppercase sm:text-7xl">{activeReveal.reveal.juryCountry}</h2><p className="mt-5 text-xl font-semibold text-pink-50/70">Jürisinin oyları geliyor</p></div></div>}
      {activeReveal?.stage === 'points' && activeReveal.score && <div key={`${activeReveal.reveal.revealOrder}-${activeReveal.scoreIndex}`} className="pointer-events-none fixed inset-x-0 top-24 z-50 flex justify-center px-4" role="status" aria-live="assertive"><div className={`jury-point-card flex w-full max-w-xl items-center gap-4 rounded-3xl border p-4 sm:p-5 ${activeReveal.score.points === 12 ? 'jury-point-card-twelve' : ''}`}><span className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-white/15 font-display font-black"><strong className="text-3xl leading-none">{activeReveal.score.points}</strong><small className="mt-1 text-[9px] uppercase tracking-wider text-white/60">puan</small></span><div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-[.2em] text-pink-100/55">{activeReveal.reveal.juryFlag} {activeReveal.reveal.juryCountry} jürisi</p><p className="mt-1 truncate font-display text-2xl font-black uppercase sm:text-3xl">{activeReveal.score.flag} {activeReveal.score.country}</p></div><span className="hidden text-xs font-bold text-pink-100/45 sm:block">{activeReveal.scoreIndex}/10</span></div></div>}
      {activeReveal?.stage === 'complete' && <div className="pointer-events-none fixed inset-x-0 top-24 z-50 flex justify-center px-4" role="status" aria-live="polite"><div className="jury-point-card flex items-center gap-3 rounded-full border px-6 py-4"><Sparkles className="text-orange" /><span className="font-bold">{activeReveal.reveal.juryCountry} jürisinin oyları tamamlandı</span></div></div>}
    </section>

      {openingStage && <div className="results-opening fixed inset-0 z-[100] overflow-hidden bg-black" role="status" aria-live="assertive">
        <div className={`results-opening-stars absolute inset-0 transition-opacity duration-1000 ${openingStage === 'black' ? 'opacity-0' : 'opacity-100'}`} />
        {openingElapsed !== null && openingElapsed >= OPENING_TIMING.titleAt && openingElapsed < OPENING_TIMING.titleEndAt && <div className="results-opening-title absolute inset-0 z-10">
          <span className="opening-word opening-word-united">UNITED</span>
          <span className="opening-word opening-word-by">BY</span>
          <span className="opening-word opening-word-music">MUSIC</span>
        </div>}
        <video ref={videoRef} className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-700 ${openingStage === 'video' && videoReady ? 'opacity-100' : 'opacity-0'}`} src={openingVideoUrl} muted playsInline preload="auto" onCanPlay={() => setVideoReady(true)} onError={() => setVideoReady(false)} />
        {openingStage === 'video' && !videoReady && <div className="results-opening-placeholder absolute inset-0 grid place-items-center">
          <div className="opening-beam opening-beam-one" /><div className="opening-beam opening-beam-two" /><div className="opening-beam opening-beam-three" />
          <div className="relative z-10 text-center"><p className="opening-placeholder-kicker">NEXAVISION</p><p className="opening-placeholder-title">BÜYÜK FİNAL<br />BAŞLIYOR</p></div>
        </div>}
        {audioBlocked && <button className="absolute bottom-8 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/30 bg-white/15 px-6 py-3 text-sm font-bold text-white backdrop-blur-xl" onClick={enableOpeningAudio}>Sesi aç</button>}
      </div>}
    </>
  );
}
