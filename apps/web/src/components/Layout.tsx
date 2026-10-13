import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Brand } from './Brand';

const links = [
  { to: '/', label: 'Home' },
  { to: '/participants', label: 'Participants' },
  { to: '/results', label: 'Results' },
];

export function Layout() {
  const [open, setOpen] = useState(false);
  return (
    <div className="aurora min-h-screen overflow-x-hidden">
      <div className="grid-mask fixed inset-0 -z-10" />
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-ink/75 backdrop-blur-2xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link to="/"><Brand /></Link>
          <nav className="hidden items-center gap-8 md:flex" aria-label="Primary navigation">
            {links.map((item) => <NavLink key={item.to} to={item.to} className={({ isActive }) => `text-sm font-medium transition ${isActive ? 'text-white' : 'text-slate-400 hover:text-white'}`}>{item.label}</NavLink>)}
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <Link to="/admin" className="px-3 py-2 text-sm text-slate-400 transition hover:text-white">Organizer</Link>
            <Link to="/jury" className="btn-primary">Jury login</Link>
          </div>
          <button className="rounded-xl p-2 md:hidden" onClick={() => setOpen(!open)} aria-label="Toggle navigation">{open ? <X /> : <Menu />}</button>
        </div>
        {open && <div className="border-t border-white/10 bg-ink/95 p-5 md:hidden"><div className="flex flex-col gap-3">{links.map((item) => <Link key={item.to} to={item.to} onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 text-slate-200 hover:bg-white/5">{item.label}</Link>)}<Link to="/jury" onClick={() => setOpen(false)} className="btn-primary mt-2">Jury login</Link></div></div>}
      </header>
      <main><Outlet /></main>
      <footer className="border-t border-white/[0.08] px-5 py-8 text-center text-sm text-slate-500">Nexavision is an independent fan contest platform. Not affiliated with the Eurovision Song Contest.</footer>
    </div>
  );
}

