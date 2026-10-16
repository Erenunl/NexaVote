import { Medal, Sparkles, Trophy } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

type Champion = {
  id: string;
  editionId: string;
  editionName: string;
  editionYear: number;
  placement: number;
  country: string;
  flag: string;
  artist: string;
  songTitle: string;
  totalPoints: number;
};

type EditionPodium = {
  id: string;
  name: string;
  year: number;
  champions: Champion[];
};

const placementLabels: Record<number, string> = { 1: 'Şampiyon', 2: 'İkinci', 3: 'Üçüncü' };

export function ChampionsPage() {
  const [champions, setChampions] = useState<Champion[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api<{ champions: Champion[] }>('/api/public/champions')
      .then((data) => setChampions(data.champions))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);
  const editions = useMemo(() => champions.reduce<EditionPodium[]>((groups, champion) => {
    let group = groups.find((item) => item.id === champion.editionId);
    if (!group) {
      group = { id: champion.editionId, name: champion.editionName, year: champion.editionYear, champions: [] };
      groups.push(group);
    }
    group.champions.push(champion);
    return groups;
  }, []), [champions]);

  return <section className="mx-auto min-h-[75vh] max-w-7xl px-5 py-16 lg:px-8">
    <div className="max-w-3xl">
      <p className="eyebrow">Nexavision tarihçesi</p>
      <h1 className="mt-3 font-display text-5xl font-black uppercase tracking-[-.045em] sm:text-7xl">Şampiyonlar<br /><span className="text-gradient">salonu</span></h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-pink-50/65">Her dönemin kupaya uzanan ülkesi ve podyumu tamamlayan unutulmaz performanslar.</p>
    </div>

    <div className="mt-12 space-y-10">{editions.map((edition) => {
      const displayOrder = [...edition.champions].sort((a, b) => {
        const order: Record<number, number> = { 2: 0, 1: 1, 3: 2 };
        return (order[a.placement] ?? 3) - (order[b.placement] ?? 3);
      });
      return <article key={edition.id} className="panel overflow-hidden p-5 sm:p-8">
        <div className="relative z-10 flex flex-col justify-between gap-3 border-b border-white/15 pb-6 sm:flex-row sm:items-end">
          <div><p className="eyebrow">{edition.year} dönemi</p><h2 className="mt-2 font-display text-3xl font-black uppercase">{edition.name}</h2></div>
          <p className="text-sm font-semibold text-pink-100/55">Resmî ilk üç</p>
        </div>
        <div className="relative z-10 mt-7 grid items-end gap-4 md:grid-cols-3">{displayOrder.map((champion) => <PodiumCard key={champion.id} champion={champion} />)}</div>
      </article>;
    })}</div>

    {!loading && editions.length === 0 && <div className="panel mt-12 p-12 text-center text-pink-50/60"><Sparkles className="mx-auto mb-4 h-8 w-8 text-softpink" /><h2 className="font-display text-2xl font-bold text-white">İlk podyum açıklanmayı bekliyor</h2><p className="mt-3">Bir dönemin sonuçları tamamlandığında ilk üç burada kalıcı olarak yerini alacak.</p></div>}
  </section>;
}

function PodiumCard({ champion }: { champion: Champion }) {
  const isWinner = champion.placement === 1;
  const accent = isWinner
    ? 'from-orange via-coral to-pink border-orange/60 shadow-orange/25'
    : champion.placement === 2
      ? 'from-white/30 via-softpink/25 to-violet/30 border-white/35 shadow-softpink/10'
      : 'from-orange/35 via-coral/25 to-purple/40 border-orange/30 shadow-orange/10';
  return <div className={`relative overflow-hidden rounded-[1.65rem] border bg-gradient-to-br p-5 shadow-2xl ${accent} ${isWinner ? 'md:-translate-y-5 md:py-8' : ''}`}>
    <div className="flex items-start justify-between gap-3">
      <span className="text-5xl drop-shadow-xl sm:text-6xl">{champion.flag}</span>
      <span className={`grid h-12 w-12 place-items-center rounded-2xl border border-white/30 ${isWinner ? 'bg-orange text-white' : 'bg-white/15 text-pink-50'}`}>
        {isWinner ? <Trophy className="h-6 w-6" /> : <Medal className="h-6 w-6" />}
      </span>
    </div>
    <p className="mt-7 text-xs font-black uppercase tracking-[.22em] text-pink-100/65">{champion.placement}. · {placementLabels[champion.placement]}</p>
    <h3 className="mt-2 font-display text-2xl font-black uppercase">{champion.country}</h3>
    <p className="mt-5 font-display text-lg font-bold">{champion.songTitle}</p>
    <p className="mt-1 text-sm text-pink-50/65">{champion.artist}</p>
    <div className="mt-6 flex items-center justify-between border-t border-white/20 pt-4 text-xs font-bold uppercase tracking-wider text-pink-100/60">
      <span>{champion.editionYear}</span><span>{champion.totalPoints} puan</span>
    </div>
  </div>;
}
