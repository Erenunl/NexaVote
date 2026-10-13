import { ExternalLink, Music2, Search, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

export type Participant = { id: string; countryId: string; code: string; country: string; flag: string; artist: string; songTitle: string; youtubeUrl?: string };

export function ParticipantsPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [search, setSearch] = useState('');
  useEffect(() => { api<{ participants: Participant[] }>('/api/public/participants').then((data) => setParticipants(data.participants)).catch(() => undefined); }, []);
  const filtered = useMemo(() => participants.filter((entry) => `${entry.country} ${entry.artist} ${entry.songTitle}`.toLowerCase().includes(search.toLowerCase())), [participants, search]);
  return (
    <section className="mx-auto min-h-[75vh] max-w-7xl px-5 py-16 lg:px-8">
      <div className="flex flex-col justify-between gap-7 md:flex-row md:items-end">
        <div><p className="eyebrow">The class of 2026</p><h1 className="mt-3 font-display text-5xl font-black uppercase tracking-[-.045em] sm:text-7xl">Meet the<br /><span className="text-gradient">participants</span></h1><p className="mt-4 max-w-2xl text-pink-50/65">Every country, artist and song taking the Nexavision stage.</p></div>
        <label className="relative block w-full md:max-w-sm"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-softpink" /><input className="input pl-11" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search country, artist or song" /></label>
      </div>
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((entry, index) => (
        <article key={entry.id} className="country-card panel group overflow-hidden p-1 transition duration-300 hover:-translate-y-1 hover:border-softpink/60">
          <div className="score-sheen relative rounded-[1.55rem] p-5">
            <div className="flex items-start justify-between"><span className="text-5xl drop-shadow-xl">{entry.flag}</span><span className="font-display text-4xl font-black text-white/15">{String(index + 1).padStart(2, '0')}</span></div>
            <div className="mt-10"><p className="text-xs font-black uppercase tracking-[.2em] text-softpink">{entry.country}</p><h2 className="mt-2 font-display text-2xl font-bold">{entry.songTitle}</h2><p className="mt-1 text-pink-50/60">{entry.artist}</p></div>
            <div className="mt-6 flex items-center justify-between border-t border-white/20 pt-4"><span className="flex items-center gap-2 text-xs text-pink-100/50"><Music2 className="h-4 w-4 text-orange" />Official entry</span>{entry.youtubeUrl && <a href={entry.youtubeUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-bold text-white transition hover:text-softpink">Watch <ExternalLink className="h-4 w-4" /></a>}</div>
          </div>
        </article>
      ))}</div>
      {participants.length === 0 && <div className="panel mt-12 p-12 text-center text-pink-50/60"><Sparkles className="mx-auto mb-4 h-7 w-7 text-softpink" />Participant data will appear when the contest entries are ready.</div>}
    </section>
  );
}
