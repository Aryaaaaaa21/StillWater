import { ArrowRight, ArrowUpRight, Check, Fingerprint, Leaf, LockKeyhole, Settings2, ShieldCheck, Waves } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useContractState } from '../hooks/useContractState';
import { getContractAddress, getNetwork } from '../config';

export default function HomePage() {
  const { ledgerState: state, error } = useContractState(15000);
  const address = getContractAddress();
  const live = Boolean(state);
  const expired = live && Number(state?.claim_expiry) * 1000 <= Date.now();
  const open = live && Boolean(state?.room_open) && !expired;
  return <div className="page overview-page">
    <div className="page-intro"><div><h1>Your space. Your boundaries.</h1><p>A quieter way to prove you belong, without sharing the whole story.</p></div><span className="subtle-label"><Leaf size={14} />Privacy, considered.</span></div>
    <section className="hero" aria-labelledby="hero-title">
      <img className="hero-image" src="/images/stillwater-lake.jpg" alt="An alpine lake reflecting mountains and forest in still water" width="1800" height="1200" fetchPriority="high" />
      <div className="hero-shade" />
      <div className="hero-content"><span className="hero-tag"><span />Private access, powered by Midnight</span><h2 id="hero-title">Belong here.<br />Leave less behind.</h2><p>Prove you meet the rule.<br />Keep the details that make you, you.</p><Link className="button light" to="/claim">Explore your access <ArrowUpRight size={17} /></Link></div>
      <div className="hero-note"><Waves size={26} strokeWidth={1.2} /><span>Nothing to overshare.<br /><strong>Something to prove.</strong></span></div>
      <div className="image-caption">Still water. Clear boundaries.</div>
    </section>
    <div className="metrics-row" aria-label="Workspace summary">
      <div className="metric"><span className="metric-icon"><Settings2 size={20} /></span><div><p>Public threshold</p><strong>{live ? state?.claim_threshold.toString() : '—'}<small>{live ? ' / 100' : 'Not configured'}</small></strong></div></div>
      <div className="metric"><span className="metric-icon"><Fingerprint size={20} /></span><div><p>Access receipts</p><strong>{live ? state?.claims.toString() : '—'}<small>{live ? ` of ${state?.claim_limit.toString()} places` : 'No indexed room'}</small></strong></div></div>
      <div className="metric"><span className="metric-icon"><LockKeyhole size={20} /></span><div><p>Private witness values</p><strong>3<small>Never written to the ledger</small></strong></div></div>
    </div>
    <div className="dashboard-columns">
      <section className="panel policy-panel"><div className="section-heading"><h2>Your active space</h2><span className={`status-badge ${open ? 'positive' : ''}`}><span />{open ? 'Open for access' : expired ? 'Expired' : live ? 'Paused' : 'Awaiting deployment'}</span></div>
        <div className="policy-content"><div className="policy-art"><img src="/images/forest.jpg" alt="Sunlight falling through a secluded green forest" width="900" height="600" loading="lazy" /><span><Leaf size={17} />A space of your own</span></div><div className="policy-copy"><span className="label">Eligibility workspace</span><h3>{live ? 'One rule. An open door.' : 'Make room for your people.'}</h3><p>{live ? 'This space checks a private score against a public threshold. The result is visible. The score is not.' : 'Set your access rule, choose a capacity, and deploy your first private eligibility space.'}</p><Link className="text-link" to={live ? '/claim' : '/admin'}>{live ? 'Check your eligibility' : 'Set up your space'}<ArrowRight size={16} /></Link></div></div>
        <div className="policy-footer"><span><span className="network-dot" />Midnight {getNetwork()}</span><span>{address ? `${address.slice(0, 8)}…${address.slice(-6)}` : 'No contract connected'}</span></div>
        {error && <p className="inline-error" role="alert">The indexer is unavailable. <Link to="/ledger">Check public state</Link> before submitting.</p>}
      </section>
      <section className="privacy-card"><div className="privacy-card-top"><span className="icon-tile"><ShieldCheck size={23} strokeWidth={1.5} /></span><span className="label">Designed to disclose less</span></div><h2>The proof is public.<br />{' '}Your details aren’t.</h2><p>Your score and access secret are private inputs to the circuit, not fields on the public ledger.</p><ul className="check-list"><li><Check size={15} />Private score stays out of ledger state</li><li><Check size={15} />One receipt per secret, per room</li><li><Check size={15} />Public rules anyone can inspect</li></ul><Link className="text-link" to="/privacy">Know what’s visible <ArrowUpRight size={16} /></Link></section>
    </div>
    <section className="journey-section"><div className="section-heading"><div><h2>A small check. A clear boundary.</h2><p>From your wallet to a verifiable result.</p></div><Link className="text-link" to="/claim">Get started <ArrowRight size={16} /></Link></div><div className="journey-grid"><div><span className="step-number">1</span><h3>Connect on your terms</h3><p>Choose your wallet and network. No signup, no profile to build.</p></div><div><span className="step-number">2</span><h3>Prove the condition</h3><p>Your private input is checked against the space’s published rule.</p></div><div><span className="step-number">3</span><h3>Leave only a receipt</h3><p>A public token records access without publishing the input behind it.</p></div></div></section>
    <div className="honesty-note"><ShieldCheck size={15} /><p>Research MVP: the score is self-attested. This proves a threshold, not a verified identity or an issuer-backed credential. <Link to="/privacy">Read the trust model.</Link></p></div>
  </div>;
}
