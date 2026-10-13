import { Expand, LockKeyhole, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type Result = { countryId: string; country: string; flag: string; totalPoints: number };

export function ResultsPage() {
  const [scoreboard, setScoreboard] = useState<Result[]>([]);
  const [meta, setMeta] = useState<{ edition: string; juriesRevealed: number; juriesSubmitted: number } | null>(null);
  const [hidden, setHidden] = useState(false);
  useEffect(() => { api<{ edition: string; juriesRevealed: number; juriesSubmitted: number; scoreboard: Result[] }>('/api/public/results').then((data) => { setScoreboard(data.scoreboard); setMeta(data); }).catch(() => setHidden(true)); }, []);
  if (hidden) return <section className="mx-auto grid min-h-[75vh] max-w-3xl place-items-center px-5 py-16"><div className="panel w-full p-10 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-electric/15 text-electric"><LockKeyhole /></div><p className="eyebrow mt-7">The grand reveal awaits</p><h1 className="mt-3 font-display text-4xl font-bold">Results are under wraps</h1><p className="mx-auto mt-4 max-w-md leading-7 text-slate-400">The scoreboard will appear here when the organizers are ready to reveal the votes.</p></div></section>;
  return <section className="mx-auto min-h-[75vh] max-w-6xl px-5 py-14 lg:px-8"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="eyebrow">Official results</p><h1 className="mt-3 font-display text-5xl font-bold tracking-[-.04em]">{meta?.edition}</h1><p className="mt-3 text-slate-400">{meta?.juriesRevealed} of {meta?.juriesSubmitted} jury votes revealed</p></div><button className="btn-secondary" onClick={() => document.documentElement.requestFullscreen?.()}><Expand className="h-4 w-4" />Presentation mode</button></div><div className="panel mt-10 overflow-hidden p-3 sm:p-5">{scoreboard.map((result, index) => <div key={result.countryId} className={`mb-2 grid grid-cols-[44px_1fr_auto] items-center gap-3 rounded-2xl border p-3 transition hover:scale-[1.005] sm:grid-cols-[64px_1fr_auto] sm:p-4 ${index === 0 ? 'border-gold/30 bg-gold/[.08]' : 'border-white/[.06] bg-white/[.025]'}`}><span className={`grid h-10 w-10 place-items-center rounded-xl font-display font-bold sm:h-12 sm:w-12 ${index === 0 ? 'bg-gold text-ink' : 'bg-white/[.07] text-slate-300'}`}>{index + 1}</span><div className="flex items-center gap-3"><span className="text-3xl sm:text-4xl">{result.flag}</span><span className="font-display text-base font-semibold sm:text-xl">{result.country}</span>{index === 0 && <Trophy className="hidden h-5 w-5 text-gold sm:block" />}</div><span className="font-display text-2xl font-bold tabular-nums sm:text-3xl">{result.totalPoints}<small className="ml-1 text-xs font-medium text-slate-500">pts</small></span></div>)}</div></section>;
}

