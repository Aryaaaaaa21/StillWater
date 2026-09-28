import { useCallback, useMemo, useState } from 'react';
import { ArrowRight, Check, CircleHelp, Fingerprint, LockKeyhole, RefreshCw, ShieldCheck, Wallet } from 'lucide-react';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { createUnprovenCallTx, submitTxAsync } from '@midnight-ntwrk/midnight-js-contracts';
import { Contract } from '../managed/contract/index.js';
import { useWallet } from '../contexts/WalletContext';
import { getContractAddress, getExplorerTxUrl, getNetwork } from '../config';
import { fromHex, toHex } from '../lib/midnight';
import { getIdentity, hasRedeemedInvite, publicFingerprint } from '../lib/identity';
import { useContractState } from '../hooks/useContractState';

function compiled(score: bigint, secret: Uint8Array) {
  const witnesses = { get_private_score: (ctx: any) => [ctx.privateState, score], get_invite_secret: (ctx: any) => [ctx.privateState, secret], operator_secret: (ctx: any) => [ctx.privateState, new Uint8Array(32)] };
  return CompiledContract.make('StillwaterContract', Contract).pipe(CompiledContract.withWitnesses(witnesses), CompiledContract.withCompiledFileAssets(new URL('/managed', window.location.origin).toString())) as any;
}

export default function ClaimPage() {
  const { session, isConnected } = useWallet();
  const { ledgerState, isLoading, error, refetch } = useContractState(7000);
  const [identity] = useState(getIdentity);
  const [score, setScore] = useState('88');
  const [status, setStatus] = useState<'ready' | 'proving' | 'success' | 'error'>('ready');
  const [message, setMessage] = useState('');
  const [txId, setTxId] = useState('');
  const threshold = BigInt(ledgerState?.claim_threshold || 0);
  const scoreValue = BigInt(/^\d+$/.test(score) ? Math.min(100, Number(score)) : 0);
  const hasRedeemed = useMemo(() => hasRedeemedInvite(identity.secret, ledgerState), [identity.secret, ledgerState]);
  const available = Boolean(ledgerState?.room_open && Number(ledgerState.claim_expiry) * 1000 > Date.now() && Number(ledgerState.claims) < Number(ledgerState.claim_limit));
  const isReady = Boolean(available && scoreValue >= threshold && !hasRedeemed && isConnected && getContractAddress());

  const claim = useCallback(async () => {
    if (!ledgerState) return setMessage('No live space is indexed yet. Ask an operator to deploy one first.');
    if (!getContractAddress()) return setMessage('No Stillwater contract is configured for this network. Open Operator studio first.');
    if (!session || !isConnected) return setMessage('Connect a Midnight wallet before submitting a private proof.');
    if (scoreValue > 100 || scoreValue < threshold) return setMessage(`Your private score must meet the public threshold of ${threshold}.`);
    if (hasRedeemed) return setMessage('This access secret already has a receipt in the current space.');
    setStatus('proving'); setMessage('Building a local proof. Your score and secret stay in this session.'); setTxId('');
    try {
      const call = await createUnprovenCallTx(session.providers as any, { compiledContract: compiled(scoreValue, fromHex(identity.secret)), contractAddress: getContractAddress(), circuitId: 'claim_access', args: [], witnesses: {} } as any);
      const result = await submitTxAsync(session.providers as any, { unprovenTx: call.private.unprovenTx, circuitId: 'claim_access' } as any);
      const id = typeof result === 'string' ? result : String(result);
      setTxId(id); setStatus('success'); setMessage('The circuit accepted the claim. Only an anonymous receipt was recorded.'); window.setTimeout(() => void refetch(), 4000);
    } catch (cause: any) { setStatus('error'); setMessage(cause?.message || 'The proof could not be submitted. Check your wallet and DUST balance.'); }
  }, [hasRedeemed, identity.secret, isConnected, ledgerState, refetch, scoreValue, session, threshold]);

  return <div className="page"><div className="page-intro"><div><span className="label">Your access</span><h1>Bring the signal.<br />Keep the context.</h1><p>Prove one private condition against this space’s public rule. The score you enter is never a public circuit argument.</p></div></div>
    <div className="form-layout"><div className="panel"><div className="mini-banner"><img src="/images/forest.jpg" alt="A quiet forest path" /><div><span className="label" style={{color:'#edf4e8'}}>Private eligibility</span><h2>One quiet check.</h2><p>Pass the rule. Leave less behind.</p></div></div>
      <div className="section-heading"><h2>Current space</h2><span className={`status-badge ${available ? 'positive' : ''}`}><span />{available ? 'Accepting claims' : ledgerState ? 'Not accepting' : 'Not configured'}</span></div>
      {isLoading && !ledgerState ? <div className="empty-state compact"><RefreshCw className="spin" size={20} />Reading public state…</div> : error ? <div className="notice error" role="alert">{error}</div> : !ledgerState ? <div className="empty-state compact"><ShieldCheck size={24} /><h2>No active space yet</h2><p>An operator needs to deploy a Stillwater contract before a claim can be checked.</p></div> : <div className="data-list"><div className="data-row"><span>Public threshold</span><strong>{threshold.toString()} / 100</strong></div><div className="data-row"><span>Open places</span><strong>{ledgerState.claims?.toString()} of {ledgerState.claim_limit?.toString()}</strong></div><div className="data-row"><span>Claim closes</span><strong>{new Date(Number(ledgerState.claim_expiry) * 1000).toLocaleDateString()}</strong></div><div className="data-row"><span>Room fingerprint</span><strong className="mono">{toHex(ledgerState.room_id).slice(0, 14)}…</strong></div></div>}
      <div className="notice"><ShieldCheck size={15} style={{verticalAlign:'-3px',marginRight:7,color:'var(--accent)'}} />The chain sees the rule, the count and a one-time receipt. It does not see the score that passed.</div>
    </div><div className="panel"><div className="section-heading"><h2>Check your eligibility</h2><span className="label">{getNetwork()}</span></div><p>For this research MVP, the score is self-attested. It demonstrates selective disclosure, not an issuer-backed credential.</p>
      <div className="field"><label htmlFor="private-score">Your private score <span>· never disclosed</span></label><input id="private-score" type="number" min="0" max="100" inputMode="numeric" value={score} onChange={event => setScore(event.target.value)} aria-describedby="score-hint" /><span className="field-hint" id="score-hint"><CircleHelp size={14} />Compared inside the Compact circuit. Not written to the ledger.</span></div>
      <div className="data-row"><span><Fingerprint size={14} style={{verticalAlign:'-3px',marginRight:6}} />Local access fingerprint</span><strong className="mono">{publicFingerprint(identity.secret).slice(0, 14)}…</strong></div><div className="data-row"><span>Replay protection</span><strong style={{color:hasRedeemed?'var(--danger)':'var(--success)'}}>{hasRedeemed ? 'Already used here' : 'Ready for this space'}</strong></div>
      {message && <div className={`notice ${status === 'error' ? 'error' : status === 'success' ? 'success' : ''}`} role={status === 'error' ? 'alert' : 'status'}>{message}</div>}
      {status === 'success' ? <div className="result-center"><div className="receipt-icon"><Check size={26} /></div><h2>Receipt recorded.</h2><p>The proof passed. The public ledger has a room-scoped receipt.</p><div className="address-block"><span>{txId}</span></div><a className="text-link" href={getExplorerTxUrl(txId)} target="_blank" rel="noreferrer">Open transaction in explorer <ArrowRight size={15} /></a></div> : <button className="button primary full-width" disabled={!isReady || status === 'proving'} onClick={() => void claim()}>{status === 'proving' ? <><RefreshCw className="spin" size={16} />Building private proof…</> : <>Generate private proof <ArrowRight size={16} /></>}</button>}
      {!isConnected && <div className="notice warning"><Wallet size={15} style={{verticalAlign:'-3px',marginRight:7}} />Connect a Midnight wallet from the top bar on {getNetwork()} to submit.</div>}<div className="honesty-note"><ShieldCheck size={14} /><p>Keep in mind: one secret is not one person. A fresh self-attested secret can claim again.</p></div>
    </div></div></div>;
}
