import { Check, ChevronRight, KeyRound, LogOut, ShieldCheck, Sparkles, Star } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api, juryToken } from '../lib/api';
import type { Participant } from './ParticipantsPage';

const points = [12, 10, 8, 7, 6, 5, 4, 3, 2, 1];
type JuryMe = { jury: { countryId: string; country: string; code: string; flag: string }; edition: { name: string; phase: string }; submitted: boolean };
type SubmittedScore = { countryId: string; country: string; flag: string; points: number };

export function JuryPage() {
  const [token, setToken] = useState(juryToken.get());
  const [me, setMe] = useState<JuryMe | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api<JuryMe>('/api/jury/me', { token }).then(setMe).catch(() => { juryToken.clear(); setToken(null); }).finally(() => setLoading(false));
  }, [token]);
  if (loading) return <PageShell><div className="panel mx-auto max-w-lg p-10 text-center text-pink-50/60">Jüri odası açılıyor…</div></PageShell>;
  if (!token || !me) return <Login onSuccess={(newToken, jury) => { juryToken.set(newToken); setToken(newToken); setMe({ jury, edition: { name: 'Nexavision', phase: 'open' }, submitted: false }); }} />;
  return <VotingRoom token={token} me={me} onLogout={() => { juryToken.clear(); setToken(null); setMe(null); }} />;
}

function Login({ onSuccess }: { onSuccess: (token: string, jury: JuryMe['jury']) => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try { const result = await api<{ token: string; jury: JuryMe['jury'] }>('/api/jury/login', { method: 'POST', body: JSON.stringify({ password }) }); onSuccess(result.token, result.jury); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Giriş yapılamadı.'); }
    finally { setBusy(false); }
  };
  return (
    <PageShell>
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 text-center"><p className="font-display text-2xl font-black tracking-[.2em] text-white">NEXA<span className="text-softpink">VISION</span></p><p className="mt-2 text-xs font-black uppercase tracking-[.35em] text-orange">Jüri Oylama Portalı</p></div>
        <div className="panel grid overflow-hidden lg:grid-cols-[.95fr_1.05fr]">
          <div className="relative flex min-h-[420px] flex-col justify-between overflow-hidden bg-gradient-to-br from-electric via-violet to-orange p-8 sm:p-11">
            <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border-[55px] border-white/10" />
            <div className="absolute -bottom-32 -left-24 h-80 w-80 rounded-full border-[42px] border-softpink/20" />
            <div className="relative"><span className="grid h-14 w-14 place-items-center rounded-2xl border border-white/30 bg-white/15 backdrop-blur-lg"><Star className="fill-white" /></span><p className="eyebrow mt-8 !text-white/70">Resmî jüri girişi</p><h1 className="mt-3 font-display text-5xl font-black uppercase leading-[.92] tracking-[-.045em]">Senin ülken.<br />Senin on iki puanın.</h1></div>
            <div className="relative mt-10 flex items-center gap-3 text-sm font-semibold text-white/80"><ShieldCheck className="h-5 w-5" />Şifreli, tek oturumlu erişim</div>
          </div>
          <form onSubmit={submit} className="relative p-8 sm:p-11">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-pink to-orange shadow-lg shadow-pink/30"><KeyRound /></div>
            <h2 className="mt-7 font-display text-3xl font-black uppercase">Jüri odasına gir</h2><p className="mt-2 text-sm text-pink-50/55">Organizatörünüzün gönderdiği özel şifreyi kullanın. Kullanıcı adı gerekmez.</p>
            <label className="mt-8 block text-sm font-bold text-pink-50/80">Jüri erişim şifresi<input autoFocus type="password" className="input mt-2" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Özel şifrenizi girin" autoComplete="current-password" /></label>
            {error && <p className="mt-4 rounded-xl border border-coral/30 bg-coral/15 px-4 py-3 text-sm text-pink-50">{error}</p>}
            <button className="btn-primary mt-6 w-full" disabled={busy || !password}>{busy ? 'Doğrulanıyor…' : 'Oylamaya devam et'} <ChevronRight className="h-4 w-4" /></button>
          </form>
        </div>
      </div>
    </PageShell>
  );
}

function VotingRoom({ token, me, onLogout }: { token: string; me: JuryMe; onLogout: () => void }) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [submittedScores, setSubmittedScores] = useState<SubmittedScore[]>([]);
  const [selections, setSelections] = useState<Record<number, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [submitted, setSubmitted] = useState(me.submitted);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ participants: Participant[]; submittedScores: SubmittedScore[] }>('/api/jury/ballot', { token }).then((data) => { setParticipants(data.participants); setSubmittedScores(data.submittedScores); if (data.submittedScores.length) setSubmitted(true); }).catch((caught) => setError(caught.message));
    const beat = () => api('/api/jury/heartbeat', { method: 'POST', token, body: JSON.stringify({ status: submitted ? 'online' : 'voting' }) }).catch(() => undefined);
    beat(); const timer = window.setInterval(beat, 30_000); return () => window.clearInterval(timer);
  }, [token, submitted]);
  const complete = Object.keys(selections).length === points.length;
  const selectedCountries = useMemo(() => new Set(Object.values(selections)), [selections]);
  const select = (score: number, countryId: string) => setSelections((current) => ({ ...current, [score]: countryId }));
  const submit = async () => {
    setBusy(true); setError('');
    try { await api('/api/jury/ballot', { method: 'POST', token, body: JSON.stringify({ scores: points.map((score) => ({ points: score, countryId: selections[score] })) }) }); setSubmitted(true); setConfirming(false); const data = await api<{ submittedScores: SubmittedScore[]; participants: Participant[] }>('/api/jury/ballot', { token }); setSubmittedScores(data.submittedScores); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Oy pusulanız gönderilemedi.'); }
    finally { setBusy(false); }
  };
  const logout = async () => { await api('/api/jury/logout', { method: 'POST', token }).catch(() => undefined); onLogout(); };

  if (submitted) return (
    <PageShell><div className="mx-auto max-w-3xl"><div className="panel overflow-hidden p-7 sm:p-10">
      <div className="stage-orbit mx-auto grid h-28 w-28 place-items-center"><span className="relative z-10 grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-pink to-orange shadow-xl shadow-pink/30"><Check className="h-10 w-10" /></span></div>
      <div className="mt-6 text-center"><p className="eyebrow">Oy pusulası alındı</p><h1 className="mt-3 font-display text-4xl font-black uppercase">Teşekkürler, {me.jury.country} Jürisi</h1><p className="mt-3 text-pink-50/55">Oyunuz kilitlendi ve güvenle kaydedildi.</p></div>
      <div className="mt-9 space-y-2">{submittedScores.map((score, index) => <div key={score.points} className={`point-ribbon reveal-row flex items-center rounded-xl border border-white/20 p-3 ${score.points === 12 ? 'point-ribbon-twelve' : ''}`} style={{ animationDelay: `${index * 55}ms` }}><span className="grid h-11 w-11 place-items-center rounded-lg border border-white/25 bg-purple/35 font-display text-lg font-black">{score.points}</span><span className="ml-4 text-2xl">{score.flag}</span><span className="ml-3 font-bold">{score.country}</span></div>)}</div>
      <button className="btn-secondary mt-8 w-full" onClick={logout}><LogOut className="h-4 w-4" />Çıkış yap</button>
    </div></div></PageShell>
  );

  return (
    <PageShell wide>
      <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="eyebrow">{me.edition.name} · Resmî jüri</p><h1 className="mt-3 font-display text-4xl font-black uppercase sm:text-5xl">{me.jury.flag} {me.jury.country} Jürisi</h1><p className="mt-3 text-pink-50/60">Her puan değerini farklı bir ülkeye verin. Kendi ülkenize oy veremezsiniz.</p></div><button className="btn-secondary self-start" onClick={logout}><LogOut className="h-4 w-4" />Çıkış yap</button></div>
      {error && <p className="mb-5 rounded-xl border border-coral/30 bg-coral/15 p-4 text-pink-50">{error}</p>}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="panel p-4 sm:p-6"><div className="space-y-3">{points.map((score, index) => (
          <div key={score} className={`point-ribbon reveal-row grid items-center gap-3 rounded-2xl border border-white/20 p-3 sm:grid-cols-[64px_1fr] ${score === 12 ? 'point-ribbon-twelve' : ''}`} style={{ animationDelay: `${index * 35}ms` }}>
            <div className="grid h-14 w-14 place-items-center rounded-xl border border-white/25 bg-purple/35 font-display text-2xl font-black">{score}</div>
            <select aria-label={`${score} puanın verileceği ülke`} className="input bg-purple/35" value={selections[score] || ''} onChange={(event) => select(score, event.target.value)}><option value="">Bir ülke seçin</option>{participants.map((entry) => <option key={entry.countryId} value={entry.countryId} disabled={selectedCountries.has(entry.countryId) && selections[score] !== entry.countryId}>{entry.flag} {entry.country} — {entry.songTitle}</option>)}</select>
          </div>
        ))}</div><button className="btn-primary mt-6 w-full" disabled={!complete} onClick={() => setConfirming(true)}><Sparkles className="h-4 w-4" />Son oy pusulasını incele</button></div>
        <aside className="panel h-fit p-5 lg:sticky lg:top-28"><p className="eyebrow">Oy pusulası ilerlemesi</p><p className="hero-number mt-3 font-display text-5xl font-black">{Object.keys(selections).length}<span className="text-lg text-pink-100/45"> / 10</span></p><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full bg-gradient-to-r from-orange via-pink to-softpink transition-all" style={{ width: `${Object.keys(selections).length * 10}%` }} /></div><div className="mt-6 space-y-2">{points.filter((score) => selections[score]).map((score) => { const entry = participants.find((item) => item.countryId === selections[score]); return <div key={score} className="flex items-center justify-between text-sm"><span className="text-pink-100/55">{score} puan</span><span className="font-semibold">{entry?.flag} {entry?.country}</span></div>; })}</div></aside>
      </div>
      {confirming && <div className="modal-backdrop fixed inset-0 z-50 grid place-items-center p-5 backdrop-blur-md"><div className="panel max-h-[90vh] w-full max-w-xl overflow-y-auto p-7"><p className="eyebrow">Son onay</p><h2 className="mt-3 font-display text-3xl font-black uppercase">Bu oy pusulası kilitlensin mi?</h2><p className="mt-2 text-pink-50/55">Gönderdikten sonra değişiklik yapamazsınız.</p><div className="mt-6 grid gap-2 sm:grid-cols-2">{points.map((score) => { const entry = participants.find((item) => item.countryId === selections[score]); return <div key={score} className="flex items-center rounded-xl border border-white/15 bg-white/[.08] p-3"><span className="font-black text-orange">{score}</span><span className="ml-3">{entry?.flag} {entry?.country}</span></div>; })}</div><div className="mt-7 flex gap-3"><button className="btn-secondary flex-1" onClick={() => setConfirming(false)} disabled={busy}>Geri dön</button><button className="btn-primary flex-1" onClick={submit} disabled={busy}>{busy ? 'Gönderiliyor…' : 'Oy pusulasını gönder'}</button></div></div></div>}
    </PageShell>
  );
}

function PageShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) { return <section className={`mx-auto min-h-[80vh] px-5 py-14 lg:px-8 ${wide ? 'max-w-7xl' : 'max-w-6xl'}`}>{children}</section>; }
