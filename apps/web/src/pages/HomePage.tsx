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
  const visibleStatuses = (statuses.length ? statuses : fallbackStatuses).slice(0, 6);

  return (
    <>
      <section className="relative mx-auto grid min-h-[720px] max-w-7xl items-center gap-10 px-5 py-16 lg:grid-cols-[1fr_1fr] lg:px-8 lg:py-20">
        <div className="relative z-10">
          <div className="broadcast-chip mb-7"><span className="status-dot animate-pulseSoft bg-orange shadow-[0_0_14px_#ff682d]" /> {phaseLabel}</div>
          <p className="eyebrow mb-4">The international fan contest</p>
          <h1 className="max-w-4xl font-display text-6xl font-black uppercase leading-[.86] tracking-[-0.055em] sm:text-8xl lg:text-[6.3rem]">
            One stage.<br /><span className="text-gradient">Every voice.</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-pink-50/75">Welcome to {contest?.name || 'Nexavision'}—where every country brings a song, every jury shapes the night, and every point changes the show.</p>
          <div className="mt-9 flex flex-wrap gap-3"><Link to="/participants" className="btn-primary">Explore the songs <ArrowRight className="h-4 w-4" /></Link><Link to="/jury" className="btn-secondary">Enter jury room</Link></div>
          <div className="mt-11 flex flex-wrap gap-x-9 gap-y-4 border-t border-white/20 pt-6 text-sm text-pink-100/60">
            <span><strong className="hero-number mr-2 font-display text-2xl text-white">{contest?.participants ?? '—'}</strong>countries</span>
            <span><strong className="hero-number mr-2 font-display text-2xl text-white">{submitted}</strong>juries submitted</span>
            {deadline && <span className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-orange" />Closes {deadline}</span>}
          </div>
        </div>
        <div className="stage-orbit mx-auto flex aspect-square w-full max-w-[590px] items-center justify-center p-7 sm:p-14">
          <div className="panel relative z-10 w-full max-w-md overflow-hidden p-5 sm:p-7">
            <div className="mb-5 flex items-center justify-between">
              <div><p className="eyebrow">Live jury pulse</p><h2 className="mt-1 font-display text-2xl font-bold">Across the stage</h2></div>
              <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-pink to-orange shadow-lg shadow-pink/30"><Radio className="h-5 w-5" /></span>
            </div>
            <div className="space-y-2">{visibleStatuses.map((item, index) => (
              <div key={item.countryId} className="reveal-row flex items-center justify-between rounded-xl border border-white/20 bg-white/[.1] px-4 py-3 backdrop-blur-md" style={{ animationDelay: `${index * 65}ms` }}>
                <div className="flex items-center gap-3"><span className="text-2xl">{item.flag}</span><span className="font-bold">{item.country}</span></div><StatusBadge status={item.status} />
              </div>
            ))}</div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-gradient-to-r from-orange via-pink to-softpink transition-all" style={{ width: `${contest?.participants ? Math.round(submitted / contest.participants * 100) : 36}%` }} /></div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 pb-24 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">{features.map(({ Icon, title, copy }, index) => (
          <div key={title} className="panel overflow-hidden p-7 transition duration-300 hover:-translate-y-1">
            <span className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${index === 0 ? 'from-pink to-electric' : index === 1 ? 'from-violet to-pink' : 'from-coral to-orange'} shadow-lg`}><Icon className="h-6 w-6" /></span>
            <h3 className="mt-6 font-display text-xl font-bold">{title}</h3><p className="mt-3 leading-7 text-pink-50/60">{copy}</p>
          </div>
        ))}</div>
      </section>
    </>
  );
}

function StatusBadge({ status }: { status: Status['status'] }) {
  const styles = { offline: 'bg-white/10 text-pink-100/55', online: 'bg-softpink/15 text-softpink', voting: 'bg-orange/20 text-orange', submitted: 'bg-emerald-400/15 text-emerald-200' };
  return <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${styles[status]}`}>{status}</span>;
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
