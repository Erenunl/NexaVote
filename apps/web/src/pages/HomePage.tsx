import { ArrowRight, Clock3, Radio, ShieldCheck, Sparkles, Trophy } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

type Contest = { id: string; name: string; year: number; phase: 'draft' | 'open' | 'closed'; resultsPublic: boolean; votingDeadline?: string; participants: number; submitted: number };
type Status = { countryId: string; country: string; flag: string; status: 'offline' | 'online' | 'voting' | 'submitted' };

export function HomePage() {
  const [contest, setContest] = useState<Contest | null>(null);
  const [statuses, setStatuses] = useState<Status[]>([]);
  useEffect(() => {
    api<{ edition: Contest }>('/api/public/contest').then((data) => setContest(data.edition)).catch(() => undefined);
    api<{ statuses: Status[] }>('/api/public/status').then((data) => setStatuses(data.statuses)).catch(() => undefined);
  }, []);
  const submitted = statuses.filter((item) => item.status === 'submitted').length || contest?.submitted || 0;
  const phaseLabel = contest?.phase === 'open' ? 'Voting is live' : contest?.phase === 'closed' ? 'Voting closed' : 'Coming soon';
  const deadline = useMemo(() => contest?.votingDeadline ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(contest.votingDeadline)) : null, [contest]);
  return (
    <>
      <section className="relative mx-auto grid min-h-[690px] max-w-7xl items-center gap-14 px-5 py-20 lg:grid-cols-[1.08fr_.92fr] lg:px-8">
        <div>
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-cyan/20 bg-cyan/10 px-4 py-2 text-xs font-semibold text-cyan"><span className="status-dot animate-pulseSoft bg-cyan" /> {phaseLabel}</div>
          <h1 className="max-w-4xl font-display text-5xl font-bold leading-[.98] tracking-[-0.06em] sm:text-7xl lg:text-[5.7rem]">One stage.<br /><span className="text-gradient">Every voice.</span></h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-slate-300">Welcome to {contest?.name || 'Nexavision'}—an international fan contest where juries turn favorite songs into one unforgettable scoreboard.</p>
          <div className="mt-9 flex flex-wrap gap-3"><Link to="/participants" className="btn-primary">Explore the songs <ArrowRight className="h-4 w-4" /></Link><Link to="/jury" className="btn-secondary">Enter jury room</Link></div>
          <div className="mt-11 flex flex-wrap gap-x-10 gap-y-4 border-t border-white/10 pt-6 text-sm text-slate-400"><span><strong className="mr-2 text-xl text-white">{contest?.participants ?? '—'}</strong>countries</span><span><strong className="mr-2 text-xl text-white">{submitted}</strong>juries submitted</span>{deadline && <span className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-gold" />Closes {deadline}</span>}</div>
        </div>
        <div className="relative mx-auto w-full max-w-xl animate-float">
          <div className="absolute -inset-6 rounded-[3rem] bg-gradient-to-tr from-electric/20 via-transparent to-cyan/15 blur-2xl" />
          <div className="panel relative overflow-hidden p-5 sm:p-7">
            <div className="mb-6 flex items-center justify-between"><div><p className="eyebrow">Live jury pulse</p><h2 className="mt-2 font-display text-2xl font-semibold">Across Europe</h2></div><Radio className="h-6 w-6 text-cyan" /></div>
            <div className="space-y-2">{(statuses.length ? statuses : fallbackStatuses).slice(0, 7).map((item, index) => <div key={item.countryId} className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-black/15 px-4 py-3.5" style={{ opacity: 1 - index * .045 }}><div className="flex items-center gap-3"><span className="text-2xl">{item.flag}</span><span className="font-medium">{item.country}</span></div><StatusBadge status={item.status} /></div>)}</div>
            <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-electric to-cyan transition-all" style={{ width: `${contest?.participants ? Math.round(submitted / contest.participants * 100) : 36}%` }} /></div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 pb-24 lg:px-8"><div className="grid gap-4 md:grid-cols-3">{features.map(({ Icon, title, copy }) => <div key={title} className="panel p-7"><Icon className="h-6 w-6 text-cyan" /><h3 className="mt-6 font-display text-xl font-semibold">{title}</h3><p className="mt-3 leading-7 text-slate-400">{copy}</p></div>)}</div></section>
    </>
  );
}

function StatusBadge({ status }: { status: Status['status'] }) {
  const styles = { offline: 'bg-slate-500/10 text-slate-400', online: 'bg-cyan/10 text-cyan', voting: 'bg-gold/10 text-gold', submitted: 'bg-emerald-400/10 text-emerald-300' };
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${styles[status]}`}>{status}</span>;
}

const fallbackStatuses: Status[] = [
  { countryId: '1', country: 'Sweden', flag: '🇸🇪', status: 'submitted' },
  { countryId: '2', country: 'Italy', flag: '🇮🇹', status: 'voting' },
  { countryId: '3', country: 'Ukraine', flag: '🇺🇦', status: 'online' },
  { countryId: '4', country: 'France', flag: '🇫🇷', status: 'submitted' },
  { countryId: '5', country: 'Norway', flag: '🇳🇴', status: 'offline' },
];

const features: Array<{ Icon: LucideIcon; title: string; copy: string }> = [
  { Icon: Sparkles, title: 'Discover every entry', copy: 'Meet the artists, hear the songs and find your favorites before the vote.' },
  { Icon: ShieldCheck, title: 'A trusted jury room', copy: 'One secure ballot per country, validated and protected from duplicate submissions.' },
  { Icon: Trophy, title: 'The grand reveal', copy: 'Watch every point reshape the ranking in a broadcast-ready results view.' },
];

