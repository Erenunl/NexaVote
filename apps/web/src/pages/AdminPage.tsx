import { Activity, CheckCircle2, Download, Eye, EyeOff, KeyRound, LogOut, Medal, Play, Radio, RefreshCcw, RotateCcw, Settings2, Shield, Square, Trash2, Trophy, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { adminToken, api, apiUrl } from '../lib/api';
import { AdminControlRoom } from './AdminControlRoom';

type Edition = { id: string; name: string; slug: string; year: number; phase: string; resultsPublic: boolean; resultsOpenedAt?: string | null; guestActive?: boolean; guestStartedAt?: string | null; winnerActive?: boolean; winnerStartedAt?: string | null; publicStatusEnabled: boolean; revealCount: number; votingDeadline?: string; auroraMode?: string; rehearsalPublic?: boolean; rehearsalOpenedAt?: string | null };
type Jury = { countryId: string; country: string; code: string; flag: string; discordUserId?: string; deliveryStatus?: string; credentialReady: number; status: string };
type Dashboard = { edition: Edition | null; stats: { total: number; submitted: number; online: number; remaining: number } | null; juries: Jury[] };
type Entry = { id: string; editionId: string; countryId: string; code: string; country: string; flag: string; artist: string; songTitle: string; youtubeUrl?: string; displayOrder: number };
type Result = { countryId: string; country: string; flag: string; totalPoints: number };
type Breakdown = { juryCountry: string; recipientCountry: string; points: number };
type SubmittedJury = { countryId: string; country: string; flag: string; submittedAt: string; revealOrder?: number | null; revealedAt?: string | null };
type Champion = { id: string; editionId: string; editionName: string; editionYear: number; placement: number; countryId: string; country: string; flag: string; artist: string; songTitle: string; totalPoints: number; createdAt: string };
type AuditEvent = { id: string; action: string; actorType: string; targetType?: string; targetId?: string; createdAt: string };

export function AdminPage() {
  const [token, setToken] = useState(adminToken.get());
  if (!token) return <AdminLogin onSuccess={(value) => { adminToken.set(value); setToken(value); }} />;
  return <AdminDashboard token={token} onLogout={() => { adminToken.clear(); setToken(null); }} />;
}

function AdminLogin({ onSuccess }: { onSuccess: (token: string) => void }) {
  const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(''); try { const data = await api<{ token: string }>('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) }); onSuccess(data.token); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Giriş yapılamadı.'); } finally { setBusy(false); } };
  return <section className="mx-auto grid min-h-[78vh] max-w-lg place-items-center px-5 py-16"><form onSubmit={submit} className="panel w-full overflow-hidden p-8 sm:p-10"><div className="mb-8 h-1.5 w-28 rounded-full bg-gradient-to-r from-orange via-pink to-electric" /><div className="grid h-16 w-16 place-items-center rounded-2xl border border-white/25 bg-gradient-to-br from-violet via-electric to-orange text-white shadow-lg shadow-electric/30"><Shield /></div><p className="eyebrow mt-7">Yönetici girişi</p><h1 className="mt-3 font-display text-4xl font-black uppercase">Kontrol odası</h1><p className="mt-2 text-sm text-pink-50/60">Yalnızca yetkili yarışma ekibi içindir.</p><input autoFocus type="password" className="input mt-7" placeholder="Yönetici şifresi" value={password} onChange={(event) => setPassword(event.target.value)} />{error && <p className="mt-4 rounded-xl border border-coral/30 bg-coral/15 p-3 text-sm text-pink-50">{error}</p>}<button className="btn-primary mt-5 w-full" disabled={!password || busy}>{busy ? 'Doğrulanıyor…' : 'Giriş yap'}</button></form></section>;
}

function AdminDashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [data, setData] = useState<Dashboard | null>(null); const [tab, setTab] = useState<'control' | 'overview' | 'entries' | 'editions' | 'results' | 'audit'>('control'); const [error, setError] = useState('');
  const load = useCallback(() => api<Dashboard>('/api/admin/dashboard', { token }).then(setData).catch((caught: Error & { code?: string }) => { if (caught.code === 'UNAUTHORIZED') onLogout(); else setError(caught.message); }), [token, onLogout]);
  useEffect(() => { load(); const timer = window.setInterval(load, 20_000); return () => window.clearInterval(timer); }, [load]);
  const patchEdition = async (patch: Record<string, unknown>) => { if (!data?.edition) return; setError(''); try { await api(`/api/admin/editions/${data.edition.id}`, { method: 'PATCH', token, body: JSON.stringify(patch) }); await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Güncelleme başarısız oldu.'); } };
  const tabLabels = { control: 'Reji', overview: 'Genel Bakış', entries: 'Katılımcılar', editions: 'Dönemler', results: 'Sonuçlar', audit: 'Denetim Kaydı' };
  return <section className="mx-auto min-h-[80vh] max-w-[1580px] px-5 py-10 lg:px-8"><div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><p className="eyebrow">Yönetici kontrol odası</p><h1 className="mt-2 font-display text-4xl font-black uppercase sm:text-5xl">{data?.edition?.name || 'Nexavision'}</h1><p className="mt-2 text-pink-50/60">Canlı yayın, prova, jüri erişimi ve sonuç yönetimi.</p></div><div className="flex gap-2"><button className="btn-secondary" onClick={load}><RefreshCcw className="h-4 w-4" />Yenile</button><button className="btn-secondary" onClick={onLogout}><LogOut className="h-4 w-4" />Çıkış yap</button></div></div>{error && <p className="mt-5 rounded-xl border border-coral/30 bg-coral/15 p-4 text-pink-50">{error}</p>}<div className="panel mt-8 flex gap-2 overflow-x-auto rounded-2xl p-2">{(['control','overview','entries','editions','results','audit'] as const).map((item) => <button key={item} onClick={() => setTab(item)} className={`rounded-xl px-5 py-2.5 text-sm font-bold transition ${tab === item ? 'bg-gradient-to-r from-electric to-coral text-white shadow-lg shadow-electric/25' : 'text-pink-50/55 hover:bg-white/10 hover:text-white'}`}>{tabLabels[item]}</button>)}</div>{tab === 'control' && data?.edition && <AdminControlRoom token={token} edition={data.edition} patchEdition={patchEdition} />}{tab === 'overview' && <Overview data={data} token={token} refresh={load} patchEdition={patchEdition} />}{tab === 'entries' && data?.edition && <Entries token={token} edition={data.edition} />}{tab === 'editions' && <Editions token={token} refreshDashboard={load} />}{tab === 'results' && data?.edition && <AdminResults token={token} edition={data.edition} patchEdition={patchEdition} />}{tab === 'audit' && <AuditLog token={token} />}</section>;
}

function Overview({ data, token, refresh, patchEdition }: { data: Dashboard | null; token: string; refresh: () => void; patchEdition: (patch: Record<string, unknown>) => Promise<void> }) {
  const [secret, setSecret] = useState<{ country: string; password: string } | null>(null);
  const [discordIds, setDiscordIds] = useState<Record<string, string>>({});
  if (!data?.edition || !data.stats) return <div className="panel mt-6 p-8 text-slate-400">Başlamak için bir yarışma dönemi oluşturun veya seçin.</div>;
  const generate = async (jury: Jury) => { const result = await api<{ generatedPassword: string }>(`/api/admin/editions/${data.edition!.id}/countries/${jury.countryId}/credential`, { method: 'POST', token, body: JSON.stringify({ generate: true }) }); setSecret({ country: jury.country, password: result.generatedPassword }); refresh(); };
  const mapDiscord = async (jury: Jury) => { const discordUserId = discordIds[jury.countryId] || jury.discordUserId; if (!discordUserId) return; await api(`/api/admin/editions/${data.edition!.id}/countries/${jury.countryId}/discord`, { method: 'PUT', token, body: JSON.stringify({ discordUserId }) }); refresh(); };
  const reset = async (jury: Jury) => { if (!window.confirm(`${jury.country} jürisinin gönderilmiş oy pusulası sıfırlansın mı?`)) return; await api(`/api/admin/editions/${data.edition!.id}/countries/${jury.countryId}/ballot`, { method: 'DELETE', token }); refresh(); };
  const revoke = async (jury: Jury) => { await api(`/api/admin/editions/${data.edition!.id}/countries/${jury.countryId}/revoke-session`, { method: 'POST', token }); refresh(); };
  const cards: Array<{ Icon: LucideIcon; value: number; label: string; color: string }> = [
    { Icon: Users, value: data.stats.total, label: 'Katılımcı jüriler', color: 'text-white' },
    { Icon: CheckCircle2, value: data.stats.submitted, label: 'Gönderilen oylar', color: 'text-emerald-300' },
    { Icon: Radio, value: data.stats.online, label: 'Şu anda çevrim içi', color: 'text-cyan' },
    { Icon: Activity, value: data.stats.remaining, label: 'Oy beklenen jüriler', color: 'text-gold' },
  ];
  return <><div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ Icon, value, label, color }) => <div key={label} className="panel p-5"><div className="flex items-center justify-between"><Icon className={`h-5 w-5 ${color}`} /><span className="text-xs uppercase tracking-widest text-slate-500">Canlı</span></div><p className="mt-5 font-display text-4xl font-bold">{value}</p><p className="mt-1 text-sm text-slate-400">{label}</p></div>)}</div><div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]"><div className="panel overflow-hidden"><div className="flex items-center justify-between border-b border-white/[.07] p-5"><div><h2 className="font-display text-xl font-semibold">Jüri izleme</h2><p className="mt-1 text-sm text-slate-500">Durumlar her 20 saniyede bir güncellenir</p></div></div><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-4">Ülke</th><th>Durum</th><th>Discord kullanıcısı</th><th>Erişim bilgisi</th><th className="pr-5 text-right">İşlemler</th></tr></thead><tbody>{data.juries.map((jury) => <tr key={jury.countryId} className="border-t border-white/[.06]"><td className="px-5 py-4"><span className="mr-3 text-2xl">{jury.flag}</span><span className="font-medium">{jury.country}</span></td><td><Status status={jury.status} /></td><td className="py-3"><div className="flex gap-2"><input className="input max-w-[190px] py-2 text-xs" value={discordIds[jury.countryId] ?? jury.discordUserId ?? ''} onChange={(event) => setDiscordIds({ ...discordIds, [jury.countryId]: event.target.value })} placeholder="Discord kullanıcı kimliği" /><button className="rounded-lg bg-white/10 px-3 text-xs hover:bg-white/15" onClick={() => mapDiscord(jury)}>Kaydet</button></div></td><td>{jury.credentialReady ? <span className="text-emerald-300">Hazır</span> : <span className="text-slate-500">Ayarlanmadı</span>}</td><td className="pr-5 text-right"><div className="flex justify-end gap-2"><button title="Şifre oluştur veya yenile" onClick={() => generate(jury)} className="rounded-lg bg-electric/15 p-2 text-electric hover:bg-electric/25"><KeyRound className="h-4 w-4" /></button><button title="Oturumu iptal et" onClick={() => revoke(jury)} className="rounded-lg bg-white/[.07] p-2 text-slate-300 hover:bg-white/10"><LogOut className="h-4 w-4" /></button>{jury.status === 'submitted' && <button title="Oy pusulasını sıfırla" onClick={() => reset(jury)} className="rounded-lg bg-rose-400/10 p-2 text-rose-300 hover:bg-rose-400/20"><RefreshCcw className="h-4 w-4" /></button>}</div></td></tr>)}</tbody></table></div></div><aside className="panel h-fit p-6"><div className="flex items-center gap-3"><Settings2 className="text-cyan" /><h2 className="font-display text-xl font-semibold">Dönem kontrolleri</h2></div><label className="mt-6 block text-xs font-bold uppercase tracking-wider text-slate-500">Oylama aşaması<select className="input mt-2" value={data.edition.phase} onChange={(event) => patchEdition({ phase: event.target.value })}><option value="draft">Taslak</option><option value="open">Açık</option><option value="closed">Kapalı</option></select></label><button className="btn-secondary mt-4 w-full justify-between" onClick={() => patchEdition({ resultsPublic: !data.edition!.resultsPublic })}><span className="flex items-center gap-2">{data.edition.resultsPublic ? <Eye /> : <EyeOff />}Herkese açık sonuçlar</span><span>{data.edition.resultsPublic ? 'Açık' : 'Kapalı'}</span></button><button className="btn-secondary mt-3 w-full justify-between" onClick={() => patchEdition({ publicStatusEnabled: !data.edition!.publicStatusEnabled })}><span className="flex items-center gap-2"><Radio />Herkese açık durum</span><span>{data.edition.publicStatusEnabled ? 'Açık' : 'Kapalı'}</span></button></aside></div>{secret && <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-5 backdrop-blur-md"><div className="panel w-full max-w-lg p-8"><p className="eyebrow">Tek kullanımlık erişim bilgisi</p><h2 className="mt-3 font-display text-2xl font-bold">{secret.country} Jürisi</h2><p className="mt-2 text-sm text-slate-400">Şimdi kopyalayın. Düz metin olarak saklanmaz ve yeniden gösterilemez.</p><code className="mt-6 block select-all rounded-2xl border border-gold/20 bg-gold/10 p-5 text-center text-xl font-bold tracking-wider text-gold">{secret.password}</code><button className="btn-primary mt-6 w-full" onClick={() => setSecret(null)}>Kaydettim</button></div></div>}</>;
}

function Entries({ token, edition }: { token: string; edition: Edition }) {
  const [entries, setEntries] = useState<Entry[]>([]); const [form, setForm] = useState({ code: '', country: '', flag: '', artist: '', songTitle: '', youtubeUrl: '' }); const [error, setError] = useState('');
  const load = useCallback(() => api<{ entries: Entry[] }>(`/api/admin/entries?editionId=${edition.id}`, { token }).then((result) => setEntries(result.entries)), [edition.id, token]); useEffect(() => { load(); }, [load]);
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(''); try { await api('/api/admin/entries', { method: 'POST', token, body: JSON.stringify({ ...form, editionId: edition.id, displayOrder: entries.length + 1 }) }); setForm({ code: '', country: '', flag: '', artist: '', songTitle: '', youtubeUrl: '' }); load(); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Katılımcı eklenemedi.'); } };
  return <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]"><div className="panel overflow-hidden"><div className="border-b border-white/[.07] p-5"><h2 className="font-display text-xl font-semibold">Yarışma katılımcıları</h2></div><div className="divide-y divide-white/[.06]">{entries.map((entry) => <div key={entry.id} className="grid grid-cols-[50px_1fr_auto] items-center gap-3 p-4"><span className="text-3xl">{entry.flag}</span><div><p className="font-semibold">{entry.country} · {entry.songTitle}</p><p className="text-sm text-slate-500">{entry.artist}</p></div><span className="text-xs text-slate-600">#{entry.displayOrder}</span></div>)}</div></div><form onSubmit={submit} className="panel h-fit p-6"><h2 className="font-display text-xl font-semibold">Ülke katılımcısı ekle</h2><div className="mt-5 space-y-3"><div className="grid grid-cols-[1fr_80px] gap-3"><input className="input" placeholder="Ülke kodu (TR)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /><input className="input" placeholder="🇹🇷" value={form.flag} onChange={(e) => setForm({ ...form, flag: e.target.value })} /></div><input className="input" placeholder="Ülke adı" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /><input className="input" placeholder="Sanatçı" value={form.artist} onChange={(e) => setForm({ ...form, artist: e.target.value })} /><input className="input" placeholder="Şarkı adı" value={form.songTitle} onChange={(e) => setForm({ ...form, songTitle: e.target.value })} /><input className="input" placeholder="YouTube bağlantısı (isteğe bağlı)" value={form.youtubeUrl} onChange={(e) => setForm({ ...form, youtubeUrl: e.target.value })} /></div>{error && <p className="mt-3 text-sm text-rose-300">{error}</p>}<button className="btn-primary mt-5 w-full">Katılımcı ekle</button></form></div>;
}

function Editions({ token, refreshDashboard }: { token: string; refreshDashboard: () => void }) {
  const [editions, setEditions] = useState<Array<Edition & { is_current?: number; isCurrent?: number }>>([]);
  const [form, setForm] = useState({ name: '', slug: '', year: new Date().getFullYear(), votingDeadline: '' });
  const [error, setError] = useState('');
  const load = useCallback(() => api<{ editions: Array<Edition & { is_current?: number; isCurrent?: number }> }>('/api/admin/editions', { token }).then((data) => setEditions(data.editions)), [token]);
  useEffect(() => { load(); }, [load]);
  const create = async (event: FormEvent) => { event.preventDefault(); setError(''); try { await api('/api/admin/editions', { method: 'POST', token, body: JSON.stringify({ ...form, votingDeadline: form.votingDeadline ? new Date(form.votingDeadline).toISOString() : null }) }); setForm({ name: '', slug: '', year: new Date().getFullYear(), votingDeadline: '' }); load(); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Yarışma dönemi oluşturulamadı.'); } };
  const makeCurrent = async (editionId: string) => { await api(`/api/admin/editions/${editionId}`, { method: 'PATCH', token, body: JSON.stringify({ makeCurrent: true }) }); await load(); refreshDashboard(); };
  return <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]"><div className="panel overflow-hidden"><div className="border-b border-white/[.07] p-5"><h2 className="font-display text-xl font-semibold">Yarışma dönemleri</h2></div><div className="divide-y divide-white/[.06]">{editions.map((edition) => { const current = Boolean(edition.is_current ?? edition.isCurrent); const phaseLabels: Record<string, string> = { draft: 'Taslak', open: 'Açık', closed: 'Kapalı' }; return <div key={edition.id} className="flex items-center justify-between gap-4 p-5"><div><p className="font-semibold">{edition.name}</p><p className="mt-1 text-sm text-slate-500">{edition.year} · {phaseLabels[edition.phase] || edition.phase}</p></div>{current ? <span className="rounded-full bg-cyan/10 px-3 py-1 text-xs font-semibold text-cyan">Güncel</span> : <button className="btn-secondary px-4 py-2" onClick={() => makeCurrent(edition.id)}>Güncel dönem yap</button>}</div>; })}</div></div><form onSubmit={create} className="panel h-fit p-6"><h2 className="font-display text-xl font-semibold">Dönem oluştur</h2><div className="mt-5 space-y-3"><input className="input" placeholder="Dönem adı" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><input className="input" placeholder="URL kısa adı" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} /><input className="input" type="number" min="2000" max="2100" value={form.year} onChange={(event) => setForm({ ...form, year: Number(event.target.value) })} /><label className="block text-xs uppercase tracking-wider text-slate-500">Oylama bitiş zamanı<input className="input mt-2" type="datetime-local" value={form.votingDeadline} onChange={(event) => setForm({ ...form, votingDeadline: event.target.value })} /></label></div>{error && <p className="mt-3 text-sm text-rose-300">{error}</p>}<button className="btn-primary mt-5 w-full" disabled={!form.name || !form.slug}>Dönem oluştur</button></form></div>;
}

function AdminResults({ token, edition, patchEdition }: { token: string; edition: Edition; patchEdition: (patch: Record<string, unknown>) => Promise<void> }) {
  const [results, setResults] = useState<Result[]>([]);
  const [breakdown, setBreakdown] = useState<Breakdown[]>([]);
  const [submittedJuries, setSubmittedJuries] = useState<SubmittedJury[]>([]);
  const [champions, setChampions] = useState<Champion[]>([]);
  const [selectedJuryId, setSelectedJuryId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const load = useCallback(() => Promise.all([
    api<{ scoreboard: Result[]; breakdown: Breakdown[]; submittedJuries: SubmittedJury[] }>(`/api/admin/results?editionId=${edition.id}`, { token }),
    api<{ champions: Champion[] }>(`/api/admin/champions?editionId=${edition.id}`, { token }),
  ]).then(([resultData, championData]) => {
    setResults(resultData.scoreboard);
    setBreakdown(resultData.breakdown);
    setSubmittedJuries(resultData.submittedJuries);
    setChampions(championData.champions);
  }), [edition.id, token]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!edition.resultsOpenedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [edition.resultsOpenedAt]);
  const download = async (format: 'json' | 'csv') => { const response = await fetch(`${apiUrl}/api/admin/export?editionId=${edition.id}&format=${format}`, { headers: { Authorization: `Bearer ${token}` } }); if (!response.ok) return; const blob = await response.blob(); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `nexavision-${edition.slug}-results.${format}`; link.click(); URL.revokeObjectURL(link.href); };
  const revealJury = async () => {
    if (!selectedJuryId) return;
    setBusy(true);
    setError('');
    try {
      await api(`/api/admin/editions/${edition.id}/reveals/${selectedJuryId}`, { method: 'POST', token });
      setSelectedJuryId('');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Jüri oyları açıklanamadı.');
    } finally {
      setBusy(false);
    }
  };
  const removeReveal = async (jury: SubmittedJury) => {
    if (!window.confirm(`${jury.country} jürisinin açıklaması geri alınsın mı? Oy pusulası korunacak.`)) return;
    setBusy(true);
    setError('');
    try {
      await api(`/api/admin/editions/${edition.id}/reveals/${jury.countryId}`, { method: 'DELETE', token });
      setSelectedJuryId(jury.countryId);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Jüri açıklaması geri alınamadı.');
    } finally {
      setBusy(false);
    }
  };
  const snapshotChampions = async () => {
    setBusy(true);
    setError('');
    try {
      await api(`/api/admin/editions/${edition.id}/champions`, { method: 'POST', token });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'İlk üç arşivlenemedi.');
    } finally {
      setBusy(false);
    }
  };
  const removeChampion = async (champion: Champion) => {
    if (!window.confirm(`${champion.placement}. sıradaki ${champion.country} şampiyonlar arşivinden silinsin mi?`)) return;
    setBusy(true);
    setError('');
    try {
      await api(`/api/admin/champions/${champion.id}`, { method: 'DELETE', token });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Arşiv kaydı silinemedi.');
    } finally {
      setBusy(false);
    }
  };
  const juries = [...new Set(breakdown.map((vote) => vote.juryCountry))];
  const revealedJuries = submittedJuries.filter((jury) => jury.revealOrder != null).sort((a, b) => Number(a.revealOrder) - Number(b.revealOrder));
  const availableJuries = submittedJuries.filter((jury) => jury.revealOrder == null);
  const selectedJury = availableJuries.find((jury) => jury.countryId === selectedJuryId);
  const openingRemaining = edition.resultsOpenedAt
    ? Math.max(0, Math.ceil((Date.parse(edition.resultsOpenedAt) + 26_000 - now) / 1000))
    : 0;
  return <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]">
    <div className="space-y-6">
      <div className="panel p-4"><div className="space-y-2">{results.map((result, index) => <div key={result.countryId} className="grid grid-cols-[45px_1fr_auto] items-center rounded-2xl border border-white/[.06] p-3"><span className="font-display text-lg font-bold text-slate-500">{index + 1}</span><span className="font-semibold"><span className="mr-3 text-2xl">{result.flag}</span>{result.country}</span><span className="font-display text-xl font-bold">{result.totalPoints} puan</span></div>)}</div></div>
      <div className="panel p-5">
        <div className="relative z-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="eyebrow">Kalıcı arşiv</p><h2 className="mt-2 font-display text-xl font-semibold">{edition.name} podyumu</h2><p className="mt-1 text-sm text-pink-50/50">Son jüri açıklandığında otomatik kaydedilir. Bu düğmeyle istediğiniz zaman yenileyebilirsiniz.</p></div><button className="btn-secondary shrink-0" disabled={busy || results.length < 3 || Number(results[0]?.totalPoints ?? 0) <= 0} onClick={snapshotChampions}><Trophy className="h-4 w-4" />{champions.length ? 'İlk 3’ü güncelle' : 'İlk 3’ü kaydet'}</button></div>
        <div className="relative z-10 mt-5 space-y-2">{champions.map((champion) => <div key={champion.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.06] p-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${champion.placement === 1 ? 'bg-orange/25 text-orange' : 'bg-white/10 text-softpink'}`}>{champion.placement === 1 ? <Trophy className="h-5 w-5" /> : <Medal className="h-5 w-5" />}</span><span className="text-2xl">{champion.flag}</span><div className="min-w-0 flex-1"><p className="truncate font-bold">{champion.placement}. {champion.country}</p><p className="truncate text-xs text-pink-50/50">{champion.artist} · {champion.songTitle} · {champion.totalPoints} puan</p></div><button type="button" title={`${champion.country} kaydını sil`} aria-label={`${champion.country} kaydını sil`} disabled={busy} onClick={() => removeChampion(champion)} className="rounded-xl border border-rose-300/20 bg-rose-400/10 p-2 text-rose-200 transition hover:bg-rose-400/20 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button></div>)}</div>
        {champions.length === 0 && <p className="relative z-10 mt-5 rounded-2xl border border-dashed border-white/15 p-5 text-center text-sm text-pink-50/45">Bu dönem için henüz arşivlenmiş bir podyum yok.</p>}
      </div>
      <div className="panel p-5"><h2 className="font-display text-xl font-semibold">Jüri bazında puan dökümü</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{juries.map((jury) => <details key={jury} className="rounded-2xl border border-white/[.07] bg-black/15 p-4"><summary className="cursor-pointer font-semibold">{jury}</summary><div className="mt-3 space-y-1">{breakdown.filter((vote) => vote.juryCountry === jury).map((vote) => <div key={`${jury}-${vote.points}`} className="flex justify-between text-sm"><span className="text-slate-400">{vote.recipientCountry}</span><strong>{vote.points}</strong></div>)}</div></details>)}</div>{juries.length === 0 && <p className="mt-4 text-sm text-slate-500">Henüz gönderilmiş oy pusulası yok.</p>}</div>
    </div>
    <aside className="panel h-fit p-6">
      <h2 className="font-display text-xl font-semibold">Canlı sonuç kontrolü</h2>
      <button className="btn-primary mt-5 w-full" onClick={() => patchEdition({ resultsPublic: !edition.resultsPublic })}>{edition.resultsPublic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{edition.resultsPublic ? 'Sonuçları gizle' : 'Sonuç ekranını aç'}</button>
      <div className="mt-6 rounded-2xl border border-white/15 bg-black/15 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-softpink">Sıradaki jüri</p>
        <select className="input mt-3" value={selectedJuryId} onChange={(event) => setSelectedJuryId(event.target.value)}>
          <option value="">Bir jüri seçin</option>
          {availableJuries.map((jury) => <option key={jury.countryId} value={jury.countryId}>{jury.flag} {jury.country}</option>)}
        </select>
        <button className="btn-secondary mt-3 w-full" disabled={!edition.resultsPublic || edition.guestActive || edition.winnerActive || openingRemaining > 0 || !selectedJuryId || busy} onClick={revealJury}><Radio className="h-4 w-4" />{edition.guestActive ? 'Konuk yayını sürüyor' : edition.winnerActive ? 'Birinci stüdyo yayını sürüyor' : openingRemaining > 0 ? `Açılış oynatılıyor · ${openingRemaining} sn` : busy ? 'Açıklanıyor…' : selectedJury ? `${selectedJury.country} oylarını açıkla` : 'Jüri oylarını açıkla'}</button>
        {!edition.resultsPublic && <p className="mt-3 text-xs leading-5 text-orange">Önce sonuç ekranını açın; ardından seçtiğiniz jürinin puanları izleyicilere canlı aktarılır.</p>}
        {availableJuries.length === 0 && submittedJuries.length > 0 && <p className="mt-3 text-xs text-emerald-300">Gönderilen tüm jüri oyları açıklandı.</p>}
        {submittedJuries.length === 0 && <p className="mt-3 text-xs text-pink-50/50">Henüz oyunu gönderen jüri yok.</p>}
        {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}
      </div>
      <button className={`mt-5 w-full ${edition.guestActive ? 'btn-primary' : 'btn-secondary'}`} disabled={!edition.resultsPublic || openingRemaining > 0 || busy || Boolean(edition.winnerActive)} onClick={() => patchEdition({ guestActive: !edition.guestActive })}>{edition.guestActive ? <Square className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}{edition.guestActive ? 'Konuğu durdur' : 'Konuk çağır'}</button>
      <button className={`mt-3 w-full ${edition.winnerActive ? 'btn-primary' : 'btn-secondary'}`} disabled={!edition.resultsPublic || openingRemaining > 0 || busy || Boolean(edition.guestActive)} onClick={() => patchEdition({ winnerActive: !edition.winnerActive })}>{edition.winnerActive ? <Square className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}{edition.winnerActive ? 'Birinci videosunu durdur' : 'Birinciyi stüdyoya çağır'}</button>
      {!edition.resultsPublic && <p className="mt-2 text-xs leading-5 text-orange">Stüdyo yayınları için önce sonuç ekranını açın.</p>}
      <div className="mt-6">
        <div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wider text-pink-50/50">Açıklama sırası</p><span className="text-xs text-pink-50/50">{revealedJuries.length}/{submittedJuries.length}</span></div>
        <div className="mt-3 space-y-2">{revealedJuries.map((jury) => <div key={jury.countryId} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.06] px-3 py-2 text-sm"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-pink/20 font-bold">{jury.revealOrder}</span><span className="min-w-0 flex-1 truncate">{jury.flag} {jury.country}</span><button type="button" title={`${jury.country} açıklamasını geri al`} aria-label={`${jury.country} açıklamasını geri al`} disabled={busy} onClick={() => removeReveal(jury)} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-orange/20 bg-orange/10 px-2.5 py-1.5 text-xs font-bold text-orange transition hover:bg-orange/20 disabled:cursor-not-allowed disabled:opacity-40"><RotateCcw className="h-3.5 w-3.5" />Geri al</button></div>)}</div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-2"><button className="btn-secondary px-3" onClick={() => download('csv')}><Download className="h-4 w-4" />CSV</button><button className="btn-secondary px-3" onClick={() => download('json')}><Download className="h-4 w-4" />JSON</button></div>
    </aside>
  </div>;
}

const auditActionLabels: Record<string, string> = {
  'admin.login': 'Yönetici girişi',
  'edition.created': 'Yarışma dönemi oluşturuldu',
  'edition.updated': 'Yarışma dönemi güncellendi',
  'entry.created': 'Katılımcı oluşturuldu',
  'entry.updated': 'Katılımcı güncellendi',
  'discord.mapping.updated': 'Discord eşleştirmesi güncellendi',
  'discord.delivery.updated': 'Discord gönderim durumu güncellendi',
  'jury.credential.rotated': 'Jüri şifresi yenilendi',
  'jury.session.revoked': 'Jüri oturumu iptal edildi',
  'jury.login': 'Jüri girişi',
  'ballot.reset': 'Oy pusulası sıfırlandı',
  'ballot.submitted': 'Oy pusulası gönderildi',
  'results.jury_revealed': 'Jüri oyları canlı sonuçlarda açıklandı',
  'results.jury_reveal_removed': 'Jüri açıklaması geri alındı',
  'rehearsal.jury_revealed': 'Jüri oyları provada açıklandı',
  'rehearsal.jury_reveal_removed': 'Prova açıklaması geri alındı',
  'rehearsal.reset': 'Prova açıklama sırası sıfırlandı',
  'champions.snapshot_created': 'Şampiyonlar podyumu arşivlendi',
  'champions.entry_removed': 'Şampiyonlar arşivi kaydı silindi',
};

function AuditLog({ token }: { token: string }) { const [events, setEvents] = useState<AuditEvent[]>([]); useEffect(() => { api<{ events: AuditEvent[] }>('/api/admin/audit-log', { token }).then((data) => setEvents(data.events)); }, [token]); return <div className="panel mt-6 overflow-hidden"><div className="border-b border-white/[.07] p-5"><h2 className="font-display text-xl font-semibold">Güvenlik ve işlem kayıtları</h2></div><div className="divide-y divide-white/[.06]">{events.map((event) => <div key={event.id} className="grid gap-2 p-4 text-sm sm:grid-cols-[180px_1fr_120px]"><span className="text-slate-500">{new Date(event.createdAt).toLocaleString('tr-TR')}</span><span className="font-medium">{auditActionLabels[event.action] || event.action}</span><span className="text-right text-slate-500">{event.actorType === 'admin' ? 'Yönetici' : event.actorType === 'jury' ? 'Jüri' : event.actorType === 'integration' ? 'Entegrasyon' : event.actorType}</span></div>)}</div></div>; }

function Status({ status }: { status: string }) { const colors: Record<string, string> = { offline: 'bg-slate-500/10 text-slate-400', online: 'bg-cyan/10 text-cyan', voting: 'bg-gold/10 text-gold', submitted: 'bg-emerald-400/10 text-emerald-300' }; const labels: Record<string, string> = { offline: 'Çevrim dışı', online: 'Çevrim içi', voting: 'Oyluyor', submitted: 'Gönderildi' }; return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${colors[status] || colors.offline}`}>{labels[status] || status}</span>; }

