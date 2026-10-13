import { Expand, LockKeyhole, Radio, Trophy } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

type Result = { countryId: string; country: string; flag: string; totalPoints: number };

export function ResultsPage() {
  const [scoreboard, setScoreboard] = useState<Result[]>([]);
  const [meta, setMeta] = useState<{ edition: string; juriesRevealed: number; juriesSubmitted: number } | null>(null);
  const [hidden, setHidden] = useState(false);
  useEffect(() => { api<{ edition: string; juriesRevealed: number; juriesSubmitted: number; scoreboard: Result[] }>('/api/public/results').then((data) => { setScoreboard(data.scoreboard); setMeta(data); }).catch(() => setHidden(true)); }, []);
  const maxPoints = useMemo(() => Math.max(...scoreboard.map((item) => item.totalPoints), 1), [scoreboard]);
  const leader = scoreboard[0];

  if (hidden) return <section className="mx-auto grid min-h-[75vh] max-w-3xl place-items-center px-5 py-16"><div className="panel w-full overflow-hidden p-10 text-center"><div className="stage-orbit mx-auto grid h-28 w-28 place-items-center"><span className="relative z-10 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-pink to-orange shadow-lg shadow-pink/30"><LockKeyhole /></span></div><p className="eyebrow mt-7">Büyük açıklama yaklaşıyor</p><h1 className="mt-3 font-display text-4xl font-black uppercase">Sonuçlar henüz gizli</h1><p className="mx-auto mt-4 max-w-md leading-7 text-pink-50/60">Organizatörler oyları açıklamaya hazır olduğunda skor tablosu burada ışıldayacak.</p></div></section>;

  return (
    <section className="mx-auto min-h-[75vh] max-w-7xl px-5 py-14 lg:px-8">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div><div className="broadcast-chip mb-4"><Radio className="h-3.5 w-3.5 text-orange" /> Canlı skor tablosu</div><p className="eyebrow">Resmî sonuçlar</p><h1 className="mt-2 font-display text-5xl font-black uppercase tracking-[-.04em] sm:text-7xl">{meta?.edition || 'Nexavision'}</h1><p className="mt-3 text-pink-50/60">{meta?.juriesSubmitted} jüri oyununun {meta?.juriesRevealed} tanesi açıklandı</p></div>
        <button className="btn-secondary" onClick={() => document.documentElement.requestFullscreen?.()}><Expand className="h-4 w-4" />Sunum modu</button>
      </div>
      <div className="mt-10 grid gap-5 xl:grid-cols-[1fr_280px]">
        <div className="panel overflow-hidden p-3 sm:p-5">
          <div className="mb-3 flex items-center justify-between px-2 text-[10px] font-black uppercase tracking-[.2em] text-pink-100/45"><span>Sıra · Ülke</span><span>Toplam puan</span></div>
          <div className="space-y-2">{scoreboard.map((result, index) => (
            <div key={result.countryId} className={`scoreboard-row reveal-row ${index === 0 ? 'scoreboard-row-winner' : ''}`} style={{ animationDelay: `${index * 55}ms` }}>
              <span className="relative z-10 grid h-10 w-10 place-items-center rounded-lg border border-white/25 bg-purple/35 font-display text-lg font-black sm:h-11 sm:w-11">{index + 1}</span>
              <div className="relative z-10 min-w-0">
                <div className="flex items-center gap-3"><span className="text-2xl sm:text-3xl">{result.flag}</span><span className="truncate font-display text-base font-bold uppercase sm:text-xl">{result.country}</span>{index === 0 && <Trophy className="hidden h-5 w-5 text-white sm:block" />}</div>
                <div className="mt-1.5 hidden h-1 overflow-hidden rounded-full bg-purple/25 sm:block"><div className="h-full bg-white/70" style={{ width: `${Math.max(6, result.totalPoints / maxPoints * 100)}%` }} /></div>
              </div>
              <span className="relative z-10 font-display text-2xl font-black tabular-nums sm:text-3xl">{result.totalPoints}<small className="ml-1 text-[10px] font-bold uppercase text-white/60">puan</small></span>
            </div>
          ))}</div>
          {scoreboard.length === 0 && <div className="rounded-2xl border border-white/15 bg-white/[.07] p-10 text-center text-pink-50/55">Skor tablosu açıklanacak ilk puanları bekliyor.</div>}
        </div>
        <aside className="panel h-fit overflow-hidden p-6">
          <span className="text-5xl">{leader?.flag || '✨'}</span>
          <p className="eyebrow mt-6">Şu anki lider</p><h2 className="mt-2 font-display text-3xl font-black uppercase">{leader?.country || 'Oylar bekleniyor'}</h2>
          <p className="mt-2 text-pink-50/55">{leader ? `Skor tablosunda ${leader.totalPoints} puan` : 'İlk jüri açıklamasıyla yarış başlayacak.'}</p>
          <div className="mt-6 h-1.5 rounded-full bg-gradient-to-r from-orange via-pink to-electric" />
        </aside>
      </div>
    </section>
  );
}
