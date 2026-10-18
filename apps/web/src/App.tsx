import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AdminPage } from './pages/AdminPage';
import { HomePage } from './pages/HomePage';
import { JuryPage } from './pages/JuryPage';
import { ParticipantsPage } from './pages/ParticipantsPage';
import { ResultsPage } from './pages/ResultsPage';
import { ChampionsPage } from './pages/ChampionsPage';

const LiveStagePage = lazy(() => import('./pages/LiveStagePage').then((module) => ({ default: module.LiveStagePage })));

export default function App() {
  return <BrowserRouter basename={import.meta.env.BASE_URL} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="stage" element={<Suspense fallback={<div className="live-stage-public-shell live-stage-public-loading">Canlı sahne hazırlanıyor…</div>}><LiveStagePage /></Suspense>} /><Route element={<Layout />}><Route index element={<HomePage />} /><Route path="participants" element={<ParticipantsPage />} /><Route path="champions" element={<ChampionsPage />} /><Route path="jury" element={<JuryPage />} /><Route path="results" element={<ResultsPage />} /><Route path="admin" element={<AdminPage />} /><Route path="*" element={<NotFound />} /></Route></Routes></BrowserRouter>;
}

function NotFound() { return <section className="mx-auto grid min-h-[70vh] max-w-xl place-items-center px-5 text-center"><div className="panel p-10"><p className="eyebrow">404</p><h1 className="mt-3 font-display text-5xl font-black uppercase">Kuliste kayboldunuz</h1><p className="mt-4 text-pink-50/60">Aradığınız sayfa bulunamadı.</p></div></section>; }

