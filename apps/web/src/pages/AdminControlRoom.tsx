import { Clapperboard, Eye, EyeOff, MonitorPlay, Play, Radio, RotateCcw, Snowflake, Sparkles, Square, Waves, Zap } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

export type ControlRoomEdition = {
  id: string;
  name: string;
  phase: string;
  resultsPublic: boolean;
  resultsOpenedAt?: string | null;
  guestActive?: boolean;
  winnerActive?: boolean;
  auroraMode?: string;
  rehearsalPublic?: boolean;
  rehearsalOpenedAt?: string | null;
};

type RejiJury = {
  countryId: string;
  country: string;
  flag: string;
  revealOrder?: number | null;
  revealedAt?: string | null;
  rehearsalRevealOrder?: number | null;
  rehearsalRevealedAt?: string | null;
};

type Lane = 'live' | 'rehearsal';

const atmosphereModes = [
  { id: 'calm', label: 'Sakin', note: 'Karşılama ve bekleme', Icon: Waves },
  { id: 'live', label: 'Canlı', note: 'Yayın temposu', Icon: Radio },
  { id: 'ice', label: 'Buz', note: 'Soğuk mavi vurgu', Icon: Snowflake },
  { id: 'finale', label: 'Final', note: 'En güçlü kuzey ışığı', Icon: Zap },
] as const;

export function AdminControlRoom({ token, edition, patchEdition }: {
  token: string;
  edition: ControlRoomEdition;
  patchEdition: (patch: Record<string, unknown>) => Promise<void>;
}) {
  const [juries, setJuries] = useState<RejiJury[]>([]);
  const [liveSelected, setLiveSelected] = useState('');
  const [rehearsalSelected, setRehearsalSelected] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => api<{ submittedJuries: RejiJury[] }>(`/api/admin/results?editionId=${edition.id}`, { token })
    .then((data) => setJuries(data.submittedJuries))
    .catch((caught: Error) => setError(caught.message)), [edition.id, token]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(load, 3000);
    return () => window.clearInterval(timer);
  }, [load]);

  const liveRevealed = useMemo(() => juries.filter((jury) => jury.revealOrder != null).sort((a, b) => Number(a.revealOrder) - Number(b.revealOrder)), [juries]);
  const rehearsalRevealed = useMemo(() => juries.filter((jury) => jury.rehearsalRevealOrder != null).sort((a, b) => Number(a.rehearsalRevealOrder) - Number(b.rehearsalRevealOrder)), [juries]);
  const liveAvailable = juries.filter((jury) => jury.revealOrder == null);
  const rehearsalAvailable = juries.filter((jury) => jury.rehearsalRevealOrder == null);

  const reveal = async (lane: Lane) => {
    const countryId = lane === 'live' ? liveSelected : rehearsalSelected;
    if (!countryId) return;
    setBusy(`${lane}-reveal`);
    setError('');
    try {
      const suffix = lane === 'rehearsal' ? '/rehearsal' : '';
      await api(`/api/admin/editions/${edition.id}${suffix}/reveals/${countryId}`, { method: 'POST', token });
      if (lane === 'live') setLiveSelected(''); else setRehearsalSelected('');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Jüri açıklaması başlatılamadı.');
    } finally {
      setBusy(null);
    }
  };

  const undo = async (lane: Lane, jury: RejiJury) => {
    setBusy(`${lane}-undo-${jury.countryId}`);
    setError('');
    try {
      const suffix = lane === 'rehearsal' ? '/rehearsal' : '';
      await api(`/api/admin/editions/${edition.id}${suffix}/reveals/${jury.countryId}`, { method: 'DELETE', token });
      if (lane === 'live') setLiveSelected(jury.countryId); else setRehearsalSelected(jury.countryId);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Açıklama geri alınamadı.');
    } finally {
      setBusy(null);
    }
  };

  const resetRehearsal = async () => {
    if (!window.confirm('Prova açıklama sırası tamamen temizlensin mi? Gerçek oylar ve canlı sonuçlar değişmeyecek.')) return;
    setBusy('rehearsal-reset');
    setError('');
    try {
      await api(`/api/admin/editions/${edition.id}/rehearsal/reveals`, { method: 'DELETE', token });
      setRehearsalSelected('');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Prova sıfırlanamadı.');
    } finally {
      setBusy(null);
    }
  };

  const resultUrl = `${import.meta.env.BASE_URL}results`;
  const rehearsalUrl = `${resultUrl}?mode=rehearsal`;
  const liveLocked = !edition.resultsPublic || Boolean(edition.guestActive) || Boolean(edition.winnerActive);

  return <div className="reji-shell mt-6 space-y-6">
    <section className="reji-topbar">
      <div><p className="eyebrow">Yayın yönetimi</p><h2 className="mt-2 font-display text-3xl font-black uppercase">Nexavision Reji</h2></div>
      <div className="flex flex-wrap gap-2">
        <StatusLamp active={edition.resultsPublic} label="Canlı çıkış" />
        <StatusLamp active={Boolean(edition.rehearsalPublic)} label="Prova çıkışı" rehearsal />
        <StatusLamp active={edition.phase === 'open'} label="Oylama" />
      </div>
    </section>

    {error && <p className="rounded-2xl border border-rose-300/25 bg-rose-400/10 p-4 text-sm text-rose-100">{error}</p>}

    <div className="grid gap-6 2xl:grid-cols-[1.05fr_.95fr]">
      <section className="panel p-5 sm:p-6">
        <div className="relative z-10 flex items-start justify-between gap-4"><div><p className="reji-kicker">Atmosfer masası</p><h3 className="mt-2 font-display text-2xl font-bold">Kuzey ışıkları</h3><p className="mt-1 text-sm text-pink-50/55">Yoğunluk anında bütün açık sayfalara aktarılır.</p></div><Sparkles className="text-softpink" /></div>
        <div className="relative z-10 mt-5 grid gap-3 sm:grid-cols-2">
          {atmosphereModes.map(({ id, label, note, Icon }) => <button key={id} type="button" onClick={() => patchEdition({ auroraMode: id })} className={`reji-scene-button ${edition.auroraMode === id ? 'reji-scene-button-active' : ''}`}><Icon className="h-5 w-5" /><span><strong>{label}</strong><small>{note}</small></span></button>)}
        </div>
      </section>

      <section className="panel p-5 sm:p-6">
        <div className="relative z-10 flex items-start justify-between gap-4"><div><p className="reji-kicker">Program çıkışı</p><h3 className="mt-2 font-display text-2xl font-bold">Canlı sahneler</h3></div><Clapperboard className="text-cyan" /></div>
        <div className="relative z-10 mt-5 grid gap-3 sm:grid-cols-2">
          <button className={edition.resultsPublic ? 'btn-primary' : 'btn-secondary'} onClick={() => patchEdition({ resultsPublic: !edition.resultsPublic })}>{edition.resultsPublic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{edition.resultsPublic ? 'Sonuçları kapat' : 'Sonuçları yayına al'}</button>
          <a className="btn-secondary" href={resultUrl} target="_blank" rel="noreferrer"><MonitorPlay className="h-4 w-4" />Canlı monitörü aç</a>
          <button className={edition.guestActive ? 'btn-primary' : 'btn-secondary'} disabled={!edition.resultsPublic || Boolean(edition.winnerActive)} onClick={() => patchEdition({ guestActive: !edition.guestActive })}>{edition.guestActive ? <Square className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}{edition.guestActive ? 'Konuğu durdur' : 'Konuk çağır'}</button>
          <button className={edition.winnerActive ? 'btn-primary' : 'btn-secondary'} disabled={!edition.resultsPublic || Boolean(edition.guestActive)} onClick={() => patchEdition({ winnerActive: !edition.winnerActive })}>{edition.winnerActive ? <Square className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}{edition.winnerActive ? 'Birinciyi durdur' : 'Birinciyi çağır'}</button>
        </div>
      </section>
    </div>

    <div className="grid gap-6 xl:grid-cols-2">
      <CueLane title="Canlı açıklama" badge="PROGRAM" badgeClass="reji-badge-live" description="Bu kanal izleyicilerin gördüğü gerçek sonuçları değiştirir." publicActive={edition.resultsPublic} toggleLabel={edition.resultsPublic ? 'Canlı çıkışı kapat' : 'Canlı çıkışı aç'} onToggle={() => patchEdition({ resultsPublic: !edition.resultsPublic })} monitorUrl={resultUrl} available={liveAvailable} revealed={liveRevealed} selected={liveSelected} onSelected={setLiveSelected} revealOrderKey="revealOrder" disabled={liveLocked} busy={Boolean(busy)} onReveal={() => reveal('live')} onUndo={(jury) => undo('live', jury)} />
      <CueLane title="Prova açıklaması" badge="PROVA" badgeClass="reji-badge-rehearsal" description="Aynı oylarla çalışır; gerçek açıklama sırasına ve şampiyon arşivine dokunmaz." publicActive={Boolean(edition.rehearsalPublic)} toggleLabel={edition.rehearsalPublic ? 'Prova çıkışını kapat' : 'Prova çıkışını aç'} onToggle={() => patchEdition({ rehearsalPublic: !edition.rehearsalPublic })} monitorUrl={rehearsalUrl} available={rehearsalAvailable} revealed={rehearsalRevealed} selected={rehearsalSelected} onSelected={setRehearsalSelected} revealOrderKey="rehearsalRevealOrder" disabled={!edition.rehearsalPublic} busy={Boolean(busy)} onReveal={() => reveal('rehearsal')} onUndo={(jury) => undo('rehearsal', jury)} onReset={resetRehearsal} />
    </div>
  </div>;
}

function StatusLamp({ active, label, rehearsal = false }: { active: boolean; label: string; rehearsal?: boolean }) {
  return <span className={`reji-status ${active ? (rehearsal ? 'reji-status-rehearsal' : 'reji-status-live') : ''}`}><i />{label}<strong>{active ? 'AÇIK' : 'KAPALI'}</strong></span>;
}

function CueLane({ title, badge, badgeClass, description, publicActive, toggleLabel, onToggle, monitorUrl, available, revealed, selected, onSelected, revealOrderKey, disabled, busy, onReveal, onUndo, onReset }: {
  title: string; badge: string; badgeClass: string; description: string; publicActive: boolean; toggleLabel: string;
  onToggle: () => void; monitorUrl: string; available: RejiJury[]; revealed: RejiJury[]; selected: string;
  onSelected: (value: string) => void; revealOrderKey: 'revealOrder' | 'rehearsalRevealOrder'; disabled: boolean;
  busy: boolean; onReveal: () => void; onUndo: (jury: RejiJury) => void; onReset?: () => void;
}) {
  const selectedJury = available.find((jury) => jury.countryId === selected);
  return <section className="panel overflow-hidden">
    <div className="relative z-10 border-b border-white/10 p-5 sm:p-6"><div className="flex items-center justify-between gap-4"><div><span className={`reji-badge ${badgeClass}`}>{badge}</span><h3 className="mt-3 font-display text-2xl font-bold">{title}</h3></div><Radio className={publicActive ? 'animate-pulseSoft text-softpink' : 'text-pink-50/30'} /></div><p className="mt-3 max-w-xl text-sm leading-6 text-pink-50/55">{description}</p></div>
    <div className="relative z-10 space-y-4 p-5 sm:p-6">
      <div className="grid gap-2 sm:grid-cols-2"><button className={publicActive ? 'btn-primary' : 'btn-secondary'} onClick={onToggle}>{publicActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{toggleLabel}</button><a className="btn-secondary" href={monitorUrl} target="_blank" rel="noreferrer"><MonitorPlay className="h-4 w-4" />Monitörü aç</a></div>
      <div className="rounded-2xl border border-white/12 bg-black/20 p-4"><label className="text-xs font-black uppercase tracking-[.18em] text-softpink">Sıradaki jüri<select className="input mt-3" value={selected} onChange={(event) => onSelected(event.target.value)}><option value="">Bir jüri seçin</option>{available.map((jury) => <option key={jury.countryId} value={jury.countryId}>{jury.flag} {jury.country}</option>)}</select></label><button className="btn-secondary mt-3 w-full" disabled={disabled || !selected || busy} onClick={onReveal}><Radio className="h-4 w-4" />{selectedJury ? `${selectedJury.country} oylarını açıkla` : 'Jüri oylarını açıkla'}</button>{!publicActive && <p className="mt-3 text-xs leading-5 text-orange">Önce bu kanalın çıkışını açın.</p>}</div>
      <div><div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-[.18em] text-pink-50/45">Açıklama sırası</p><span className="text-xs text-pink-50/45">{revealed.length}/{revealed.length + available.length}</span></div><div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">{revealed.map((jury) => <div key={jury.countryId} className="reji-cue-row"><span>{jury[revealOrderKey]}</span><strong>{jury.flag} {jury.country}</strong><button title="Açıklamayı geri al" disabled={busy} onClick={() => onUndo(jury)}><RotateCcw className="h-3.5 w-3.5" /></button></div>)}{revealed.length === 0 && <p className="rounded-xl border border-dashed border-white/12 p-4 text-center text-sm text-pink-50/40">Henüz açıklanan jüri yok.</p>}</div></div>
      {onReset && <button className="btn-secondary w-full border-orange/25 text-orange" disabled={busy || revealed.length === 0} onClick={onReset}><RotateCcw className="h-4 w-4" />Provayı başa sar</button>}
    </div>
  </section>;
}
