import { Check, ChevronRight, KeyRound, LogOut, ShieldCheck, Sparkles } from 'lucide-react';
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

  if (loading) return <PageShell><div className="panel mx-auto max-w-lg p-10 text-center text-slate-400">Opening the jury room…</div></PageShell>;
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
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to sign in.'); }
    finally { setBusy(false); }
  };
  return <PageShell><div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[.9fr_1.1fr]"><div className="flex flex-col justify-center p-2"><p className="eyebrow">Secure jury access</p><h1 className="mt-4 font-display text-5xl font-bold tracking-[-.05em]">Your country.<br /><span className="text-gradient">Your twelve points.</span></h1><p className="mt-6 max-w-md leading-7 text-slate-400">Enter the private password sent by your contest organizer. The system will identify your jury automatically.</p><div className="mt-8 flex items-center gap-3 text-sm text-slate-500"><ShieldCheck className="h-5 w-5 text-cyan" />Encrypted, single-session access</div></div><form onSubmit={submit} className="panel p-7 sm:p-10"><div className="mb-8 grid h-14 w-14 place-items-center rounded-2xl bg-electric/15 text-electric"><KeyRound /></div><h2 className="font-display text-2xl font-semibold">Enter the jury room</h2><p className="mt-2 text-sm text-slate-400">No username is needed.</p><label className="mt-8 block text-sm font-medium text-slate-300">Jury access password<input autoFocus type="password" className="input mt-2" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your private password" autoComplete="current-password" /></label>{error && <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}<button className="btn-primary mt-6 w-full" disabled={busy || !password}>{busy ? 'Verifying…' : 'Continue'} <ChevronRight className="h-4 w-4" /></button></form></div></PageShell>;
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
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to submit your ballot.'); }
    finally { setBusy(false); }
  };
  const logout = async () => { await api('/api/jury/logout', { method: 'POST', token }).catch(() => undefined); onLogout(); };

  if (submitted) return <PageShell><div className="mx-auto max-w-3xl"><div className="panel p-7 sm:p-10"><div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-400/15 text-emerald-300"><Check className="h-10 w-10" /></div><div className="mt-6 text-center"><p className="eyebrow">Ballot received</p><h1 className="mt-3 font-display text-4xl font-bold">Thank you, Jury of {me.jury.country}</h1><p className="mt-3 text-slate-400">Your vote is locked and safely recorded.</p></div><div className="mt-9 space-y-2">{submittedScores.map((score) => <div key={score.points} className="flex items-center rounded-2xl border border-white/[.07] bg-black/15 p-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-gold to-amber-500 font-display text-lg font-bold text-ink">{score.points}</span><span className="ml-4 text-2xl">{score.flag}</span><span className="ml-3 font-semibold">{score.country}</span></div>)}</div><button className="btn-secondary mt-8 w-full" onClick={logout}><LogOut className="h-4 w-4" />Sign out</button></div></div></PageShell>;

  return <PageShell wide><div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="eyebrow">{me.edition.name} · Official jury</p><h1 className="mt-3 font-display text-4xl font-bold">{me.jury.flag} Jury of {me.jury.country}</h1><p className="mt-3 text-slate-400">Award every point value to a different country. You cannot vote for yourself.</p></div><button className="btn-secondary self-start" onClick={logout}><LogOut className="h-4 w-4" />Sign out</button></div>{error && <p className="mb-5 rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-rose-200">{error}</p>}<div className="grid gap-6 lg:grid-cols-[1fr_320px]"><div className="panel p-4 sm:p-6"><div className="space-y-3">{points.map((score) => <div key={score} className="grid items-center gap-3 rounded-2xl border border-white/[.07] bg-black/15 p-3 sm:grid-cols-[64px_1fr]"><div className={`grid h-14 w-14 place-items-center rounded-2xl font-display text-2xl font-bold ${score === 12 ? 'bg-gradient-to-br from-gold to-amber-500 text-ink shadow-lg shadow-gold/20' : 'bg-white/10 text-white'}`}>{score}</div><select aria-label={`Recipient of ${score} points`} className="input" value={selections[score] || ''} onChange={(event) => select(score, event.target.value)}><option value="">Select a country</option>{participants.map((entry) => <option key={entry.countryId} value={entry.countryId} disabled={selectedCountries.has(entry.countryId) && selections[score] !== entry.countryId}>{entry.flag} {entry.country} — {entry.songTitle}</option>)}</select></div>)}</div><button className="btn-primary mt-6 w-full" disabled={!complete} onClick={() => setConfirming(true)}><Sparkles className="h-4 w-4" />Review final ballot</button></div><aside className="panel h-fit p-5"><p className="eyebrow">Ballot progress</p><p className="mt-3 font-display text-3xl font-bold">{Object.keys(selections).length}<span className="text-lg text-slate-500"> / 10</span></p><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-r from-electric to-cyan transition-all" style={{ width: `${Object.keys(selections).length * 10}%` }} /></div><div className="mt-6 space-y-2">{points.filter((score) => selections[score]).map((score) => { const entry = participants.find((item) => item.countryId === selections[score]); return <div key={score} className="flex items-center justify-between text-sm"><span className="text-slate-400">{score} points</span><span>{entry?.flag} {entry?.country}</span></div>; })}</div></aside></div>{confirming && <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-5 backdrop-blur-md"><div className="panel max-h-[90vh] w-full max-w-xl overflow-y-auto p-7"><p className="eyebrow">Final confirmation</p><h2 className="mt-3 font-display text-3xl font-bold">Lock this ballot?</h2><p className="mt-2 text-slate-400">You cannot change it after submission.</p><div className="mt-6 grid gap-2 sm:grid-cols-2">{points.map((score) => { const entry = participants.find((item) => item.countryId === selections[score]); return <div key={score} className="flex items-center rounded-xl bg-white/[.05] p-3"><span className="font-bold text-gold">{score}</span><span className="ml-3">{entry?.flag} {entry?.country}</span></div>; })}</div><div className="mt-7 flex gap-3"><button className="btn-secondary flex-1" onClick={() => setConfirming(false)} disabled={busy}>Go back</button><button className="btn-primary flex-1" onClick={submit} disabled={busy}>{busy ? 'Submitting…' : 'Submit ballot'}</button></div></div></div>}</PageShell>;
}

function PageShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) { return <section className={`mx-auto min-h-[80vh] px-5 py-14 lg:px-8 ${wide ? 'max-w-7xl' : 'max-w-6xl'}`}>{children}</section>; }

