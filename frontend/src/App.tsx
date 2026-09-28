import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { ArrowUpRight, ChevronDown, ChevronRight, Fingerprint, Home, Leaf, Loader2, LogOut, Menu, Moon, Settings2, ShieldCheck, Sun, Wallet, Waves, X, Rows3 } from 'lucide-react';
import { useWallet } from './contexts/WalletContext';
import { getNetwork, setNetwork } from './config';
import HomePage from './pages/HomePage';
const ClaimPage = lazy(() => import('./pages/ClaimPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const LedgerPage = lazy(() => import('./pages/LedgerPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));

const pageNames: Record<string, string> = { '/': 'Overview', '/claim': 'Your access', '/ledger': 'Public ledger', '/admin': 'Operator studio', '/privacy': 'Privacy model' };
export default function App() {
  const wallet = useWallet();
  const [theme, setTheme] = useState<'day' | 'night'>(() => {
    try { const saved = localStorage.getItem('stillwater.theme'); if (saved === 'day' || saved === 'night') return saved; } catch { /* storage may be unavailable */ }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day';
  });
  const [network, selectNetwork] = useState(getNetwork);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const location = useLocation();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('stillwater.theme', theme); } catch { /* theme still works in memory */ }
  }, [theme]);
  useEffect(() => { setMobileOpen(false); window.scrollTo(0, 0); document.title = `${pageNames[location.pathname] || 'Page not found'} — Stillwater`; }, [location.pathname]);
  useEffect(() => {
    if (walletOpen) dialog.current?.showModal(); else dialog.current?.close();
  }, [walletOpen]);
  useEffect(() => {
    const open = () => setWalletOpen(true);
    window.addEventListener('stillwater:open-wallet', open);
    return () => window.removeEventListener('stillwater:open-wallet', open);
  }, []);
  const changeNetwork = (value: 'preview' | 'preprod') => {
    wallet.disconnect(); setNetwork(value); selectNetwork(value);
  };

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    {mobileOpen && <button className="sidebar-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
    <aside className={`sidebar ${mobileOpen ? 'is-open' : ''}`} aria-label="Workspace sidebar">
      <Link to="/" className="brand" aria-label="Stillwater home"><span className="brand-symbol"><Waves size={25} strokeWidth={1.5} /></span><span>stillwater<span className="brand-period">.</span></span></Link>
      <div className="workspace-label"><span className="workspace-avatar"><Leaf size={17} /></span><span>Private access workspace<small>Built on Midnight</small></span></div>
      <p className="nav-caption">Your workspace</p>
      <nav className="nav-group" aria-label="Primary navigation">
        <NavLink to="/" end><Home size={18} />Overview</NavLink>
        <NavLink to="/claim"><Fingerprint size={18} />Your access</NavLink>
        <NavLink to="/ledger"><Rows3 size={18} />Public ledger</NavLink>
      </nav>
      <p className="nav-caption tools-caption">Workspace tools</p>
      <nav className="nav-group" aria-label="Tools">
        <NavLink to="/admin"><Settings2 size={18} />Operator studio</NavLink>
        <NavLink to="/privacy"><ShieldCheck size={18} />Privacy model</NavLink>
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-note"><Leaf size={20} strokeWidth={1.5} /><p>A little proof.<br />A lot more privacy.</p><Link to="/privacy">Understand the boundary <ArrowUpRight size={14} /></Link></div>
        <div className="theme-switch" role="group" aria-label="Appearance"><button onClick={() => setTheme('day')} aria-pressed={theme === 'day'}><Sun size={15} />Day</button><button onClick={() => setTheme('night')} aria-pressed={theme === 'night'}><Moon size={15} />Night</button></div>
        <div className="sidebar-foot"><span className="midnight-mark" /> Powered by Midnight <span>v1.0</span></div>
      </div>
    </aside>
    <div className="workspace">
      <header className="topbar">
        <button className="icon-button mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Open navigation" aria-expanded={mobileOpen}><Menu size={21} /></button>
        <div className="breadcrumb"><span>Workspace</span><ChevronRight size={13} /><strong>{pageNames[location.pathname] || 'Not found'}</strong></div>
        <div className="topbar-actions">
          <div className="network-picker"><span className="network-dot" /><label className="sr-only" htmlFor="active-network">Midnight network</label><select id="active-network" value={network} onChange={event => changeNetwork(event.target.value as 'preview' | 'preprod')} disabled={wallet.isConnecting}><option value="preview">Preview</option><option value="preprod">Preprod</option></select><ChevronDown size={12} /></div>
          <button className="button primary connect-button" onClick={() => setWalletOpen(true)} disabled={wallet.isConnecting}>{wallet.isConnecting ? <Loader2 size={16} className="spin" /> : <Wallet size={16} />}<span>{wallet.isConnecting ? 'Connecting…' : wallet.isConnected ? `${wallet.address?.slice(0, 8)}…${wallet.address?.slice(-4)}` : 'Connect wallet'}</span></button>
        </div>
      </header>
      {wallet.error && <div className="global-error" role="alert"><span>{wallet.error}</span><button className="icon-button" onClick={wallet.clearError} aria-label="Dismiss wallet error"><X size={17} /></button></div>}
      <main id="main-content" tabIndex={-1}><Suspense fallback={<div className="route-loading" role="status"><Loader2 className="spin" size={20} /> Opening workspace…</div>}><Routes>
        <Route path="/" element={<HomePage />} /><Route path="/claim" element={<ClaimPage />} /><Route path="/admin" element={<AdminPage />} /><Route path="/ledger" element={<LedgerPage />} /><Route path="/privacy" element={<PrivacyPage />} />
        <Route path="*" element={<div className="page"><div className="empty-state"><Waves size={36} /><h1>A little off course.</h1><p>This page isn’t part of your workspace.</p><Link className="button primary" to="/">Back to overview</Link></div></div>} />
      </Routes></Suspense></main>
      <footer className="workspace-footer"><span><Waves size={16} /> Stillwater. Less revealed, more possible.</span><span>Zero-knowledge access on Midnight</span></footer>
    </div>
    <dialog ref={dialog} className="wallet-dialog" onCancel={() => setWalletOpen(false)} onClick={event => { if (event.target === event.currentTarget) setWalletOpen(false); }} aria-labelledby="wallet-title">
      <div className="dialog-top"><span className="icon-tile"><Wallet size={23} /></span><button className="icon-button" onClick={() => setWalletOpen(false)} aria-label="Close wallet dialog"><X size={20} /></button></div>
      <h2 id="wallet-title">{wallet.isConnected ? 'Your connected wallet' : 'Bring your own wallet.'}</h2>
      <p>{wallet.isConnected ? `Connected with ${wallet.walletName} on ${network}. Disconnecting clears the active application session.` : `Choose a Midnight wallet to continue on ${network}. Stillwater never asks for your wallet seed phrase.`}</p>
      {wallet.isConnected ? <><div className="address-block">{wallet.address}</div><button className="button full-width" onClick={() => { wallet.disconnect(); setWalletOpen(false); }}><LogOut size={16} />Disconnect wallet</button></> : <>
        {wallet.availableWallets.map(entry => <button key={entry.id} className="wallet-option" disabled={wallet.isConnecting} onClick={async () => { const connected = await wallet.connect(network, entry.id); if (connected) setWalletOpen(false); }}><span><Wallet size={20} />{entry.name}</span>{wallet.isConnecting ? <Loader2 className="spin" size={16} /> : <ChevronRight size={17} />}</button>)}
        {wallet.availableWallets.length === 0 && <div className="notice"><strong>{wallet.walletStatus === 'checking' ? 'Looking for your wallet…' : 'No compatible wallet detected'}</strong><p>Install and unlock Lace, 1AM, or a compatible Midnight Nightly connector. Select {network} in the extension, then reload this page.</p></div>}
      </>}
      {wallet.error && <div role="alert" className="notice error">{wallet.error}</div>}
      <div className="dialog-foot"><ShieldCheck size={14} />You approve every transaction in your wallet.</div>
    </dialog>
  </div>;
}
