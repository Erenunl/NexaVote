import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Brand } from './Brand';

const links = [
  { to: '/', label: 'Ana Sayfa' },
  { to: '/participants', label: 'Katılımcılar' },
  { to: '/champions', label: 'Şampiyonlar' },
  { to: '/results', label: 'Sonuçlar' },
];

export function Layout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); setOpen(false); }, [pathname]);
  return (
    <div className="min-h-screen overflow-x-hidden">
      <div className="broadcast-bg" aria-hidden="true">
        <span className="spark-field" />
        <span className="ribbon ribbon-one" />
        <span className="ribbon ribbon-two" />
        <span className="ribbon ribbon-three" />
      </div>
      <header className="sticky top-0 z-40 border-b border-white/20 bg-purple/75 shadow-[0_8px_35px_rgba(72,17,100,.25)] backdrop-blur-2xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link to="/"><Brand /></Link>
          <nav className="hidden items-center gap-8 md:flex" aria-label="Ana menü">
            {links.map((item) => <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-link py-2 text-sm font-bold transition ${isActive ? 'nav-link-active text-white' : 'text-pink-100/65 hover:text-white'}`}>{item.label}</NavLink>)}
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <Link to="/admin" className="px-3 py-2 text-sm font-semibold text-pink-100/70 transition hover:text-white">Yönetici</Link>
            <Link to="/jury" className="btn-primary">Jüri girişi</Link>
          </div>
          <button className="rounded-xl p-2 md:hidden" onClick={() => setOpen(!open)} aria-label="Menüyü aç veya kapat">{open ? <X /> : <Menu />}</button>
        </div>
        {open && <div className="border-t border-white/20 bg-purple/95 p-5 md:hidden"><div className="flex flex-col gap-3">{links.map((item) => <Link key={item.to} to={item.to} onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 font-semibold text-pink-50 hover:bg-white/10">{item.label}</Link>)}<Link to="/admin" onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 font-semibold text-pink-100/75 hover:bg-white/10">Yönetici</Link><Link to="/jury" onClick={() => setOpen(false)} className="btn-primary mt-2">Jüri girişi</Link></div></div>}
      </header>
      <main><Outlet /></main>
      <footer className="border-t border-white/15 bg-purple/35 px-5 py-8 text-center text-sm text-pink-100/55 backdrop-blur-lg">Nexavision bağımsız bir hayran yarışması platformudur. Eurovision Şarkı Yarışması ile bağlantılı değildir.</footer>
    </div>
  );
}

