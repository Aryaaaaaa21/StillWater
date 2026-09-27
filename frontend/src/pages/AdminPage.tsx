import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Copy, ExternalLink, Eye, EyeOff, KeyRound, Loader2, Lock, Pause, Play, Plus, RefreshCw, Settings2, ShieldCheck, Wallet } from 'lucide-react';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { createUnprovenCallTx, createUnprovenDeployTx, submitTxAsync } from '@midnight-ntwrk/midnight-js-contracts';
import { sampleSigningKey } from '@midnight-ntwrk/compact-runtime';
import { Contract, pureCircuits } from '../managed/contract/index.js';
import { useWallet } from '../contexts/WalletContext';
import { DEFAULT_CLAIM_LIMIT, DEFAULT_CLAIM_THRESHOLD, getContractAddress, getExplorerContractUrl, getNetwork, setContractAddress } from '../config';
import { fromHex, toHex } from '../lib/midnight';
import { useContractState } from '../hooks/useContractState';

const OPERATOR_KEY = 'stillwater.operator.secret';
const randomHex = () => toHex(crypto.getRandomValues(new Uint8Array(32)));
function getCompiledContract(operatorSecret?: Uint8Array) {
  const witnesses = { get_private_score: (ctx: any) => [ctx.privateState, 0n], get_invite_secret: (ctx: any) => [ctx.privateState, new Uint8Array(32)], operator_secret: (ctx: any) => [ctx.privateState, operatorSecret || new Uint8Array(32)] };
  return CompiledContract.make('StillwaterContract', Contract).pipe(CompiledContract.withWitnesses(witnesses), CompiledContract.withCompiledFileAssets(new URL('/managed', window.location.origin).toString())) as any;
}
type DeploymentState = 'idle' | 'deploying' | 'deployed' | 'error';
export default function AdminPage() {
  const { session, isConnected } = useWallet();
  const [secret, setSecret] = useState(() => { try { return sessionStorage.getItem(OPERATOR_KEY) || randomHex(); } catch { return randomHex(); } });
  const [showSecret, setShowSecret] = useState(false);
  const [threshold, setThreshold] = useState(String(DEFAULT_CLAIM_THRESHOLD));
  const [limit, setLimit] = useState(String(DEFAULT_CLAIM_LIMIT));
  const [status, setStatus] = useState<DeploymentState>('idle');
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [deployedAddress, setDeployedAddress] = useState<string | null>(getContractAddress() || null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const { ledgerState, isLoading, refetch } = useContractState(7000, deployedAddress || undefined);
  useEffect(() => { try { sessionStorage.setItem(OPERATOR_KEY, secret); } catch { /* memory only fallback */ } }, [secret]);
  const commitment = useMemo(() => { try { return (pureCircuits as any).operator_commitment_for(fromHex(secret)); } catch { return new Uint8Array(32); } }, [secret]);
  const valid = /^\d+$/.test(threshold) && Number(threshold) >= 0 && Number(threshold) <= 100 && /^\d+$/.test(limit) && Number(limit) > 0 && /^[a-f0-9]{64}$/i.test(secret);
  const deploy = useCallback(async () => {
    if (!session || !isConnected) return;
    if (!valid) { setStatus('error'); setErrorMsg('Threshold must be 0–100, capacity must be positive, and the operator secret must be 32 bytes in hex.'); return; }
    setStatus('deploying'); setMessage('Preparing ZK assets. Approve the deployment in your wallet.'); setErrorMsg('');
    try {
      const room = crypto.getRandomValues(new Uint8Array(32)); const issuer = crypto.getRandomValues(new Uint8Array(32)); const expiry = BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60);
      const data = await createUnprovenDeployTx(session.providers as any, { compiledContract: getCompiledContract(fromHex(secret)), args: [BigInt(threshold), room, expiry, issuer, commitment, BigInt(limit)], privateStateId: 'StillwaterOperatorState', initialPrivateState: {}, signingKey: sampleSigningKey() } as any);
      const address = data.public.contractAddress;
      await submitTxAsync(session.providers as any, { unprovenTx: data.private.unprovenTx } as any);
      setContractAddress(address); setDeployedAddress(address); setStatus('deployed'); setMessage('Deployment submitted. The indexer will show public state once the transaction is included.'); window.setTimeout(() => void refetch(), 5000);
    } catch (cause: any) { setStatus('error'); setErrorMsg(cause?.message || String(cause)); setMessage('Deployment could not be submitted.'); }
  }, [commitment, isConnected, limit, refetch, secret, session, threshold, valid]);
  const operatorAction = useCallback(async () => {
    if (!session || !ledgerState || !deployedAddress) return;
    setBusy(true); setMessage('Building operator proof…'); setErrorMsg('');
    try { const circuitId = ledgerState.room_open ? 'lock_room' : 'unlock_room'; const call = await createUnprovenCallTx(session.providers as any, { compiledContract: getCompiledContract(fromHex(secret)), contractAddress: deployedAddress, circuitId, args: [], witnesses: {} } as any); await submitTxAsync(session.providers as any, { unprovenTx: call.private.unprovenTx, circuitId } as any); setMessage(`The ${circuitId.replace('_', ' ')} transaction was submitted.`); window.setTimeout(() => void refetch(), 3500); } catch (cause: any) { setErrorMsg(cause?.message || String(cause)); setMessage('Operator proof failed.'); } finally { setBusy(false); }
  }, [deployedAddress, ledgerState, refetch, secret, session]);
  const copy = () => { if (deployedAddress) { void navigator.clipboard.writeText(deployedAddress); setCopied(true); window.setTimeout(() => setCopied(false), 1500); } };
  return <div className="page"><div className="page-intro"><div><span className="label">Workspace tools</span><h1>Set the rule.<br />Keep the secret.</h1><p>Deploy a new Stillwater space directly from a connected Midnight wallet. Proof generation and balancing stay in the browser wallet.</p></div><span className="subtle-label"><Settings2 size={14} />Operator studio</span></div>
    <div className="operator-layout two-col"><section className="panel"><div className="section-heading"><h2>Create a private space</h2><span className="status-badge"><span />{getNetwork()}</span></div><div className="notice warning"><AlertTriangle size={15} style={{verticalAlign:'-3px',marginRight:7}} />Operator secrets are sensitive plaintext. This browser keeps the value in session storage so a reload can recover it; never share it or commit it.</div>
      <div className="field"><label htmlFor="operator-secret">Operator secret <span>· local only</span></label><div className="secret-input"><input id="operator-secret" value={showSecret ? secret : `${secret.slice(0, 6)}${'•'.repeat(52)}${secret.slice(-6)}`} onChange={event => { if (showSecret) setSecret(event.target.value); }} readOnly={!showSecret} className="mono" aria-describedby="secret-hint" /><button className="icon-button" onClick={() => setShowSecret(!showSecret)} aria-label={showSecret ? 'Hide operator secret' : 'Show operator secret'}>{showSecret ? <EyeOff size={17} /> : <Eye size={17} />}</button></div><span id="secret-hint" className="field-hint"><KeyRound size={14} />Only its public commitment is written on-chain.</span><div className="secret-actions"><button className="button small" onClick={() => setSecret(randomHex())}><RefreshCw size={13} />Generate new</button><button className="button small" onClick={() => { void navigator.clipboard.writeText(secret); }}><Copy size={13} />Copy secret</button></div></div>
      <div className="form-grid"><div className="field"><label htmlFor="threshold">Public threshold <span>0–100</span></label><input id="threshold" type="number" min="0" max="100" value={threshold} onChange={event => setThreshold(event.target.value)} /></div><div className="field"><label htmlFor="limit">Space capacity</label><input id="limit" type="number" min="1" value={limit} onChange={event => setLimit(event.target.value)} /></div></div><div className="notice"><Settings2 size={14} style={{verticalAlign:'-3px',marginRight:7}} />Constructor: <code>threshold, room, expiry, issuer, operator_commitment, limit</code></div>
      {!isConnected && <button className="button full-width" onClick={() => window.dispatchEvent(new Event('stillwater:open-wallet'))}><Wallet size={16} />Connect wallet to deploy</button>}<button className="button primary full-width" onClick={() => void deploy()} disabled={!isConnected || status === 'deploying' || !valid} style={{marginTop:10}}>{status === 'deploying' ? <><Loader2 size={16} className="spin" />Approve deployment in wallet…</> : <><Plus size={16} />Deploy space to {getNetwork()}</>}</button>
      {message && <div className={`notice ${status === 'error' ? 'error' : status === 'deployed' ? 'success' : ''}`} role={status === 'error' ? 'alert' : 'status'}>{message}{errorMsg && <div className="mono" style={{marginTop:8}}>{errorMsg}</div>}</div>}
    </section><section className="panel"><div className="section-heading"><h2>Deployment receipt</h2><span className="label">{isLoading ? 'Syncing…' : deployedAddress ? 'Address saved' : 'Waiting'}</span></div>{deployedAddress ? <><div className="receipt-icon"><Check size={24} /></div><h2>Space address ready.</h2><p>Save this address for your public deployment evidence. It was written to this browser for the {getNetwork()} network only.</p><div className="address-block"><span>{deployedAddress}</span><button className="icon-button" onClick={copy} aria-label="Copy contract address">{copied ? <Check size={16} /> : <Copy size={16} />}</button></div>{copied && <p className="inline-error" style={{color:'var(--success)'}}>Copied.</p>}<a className="button" href={getExplorerContractUrl(deployedAddress)} target="_blank" rel="noreferrer"><ExternalLink size={15} />Open network explorer</a>{ledgerState && <div className="operator-actions"><div className="section-heading"><h2>Space controls</h2><span className={`status-badge ${ledgerState.room_open ? 'positive' : ''}`}><span />{ledgerState.room_open ? 'Open' : 'Locked'}</span></div><div className="data-list"><div className="data-row"><span>Public claims</span><strong>{ledgerState.claims.toString()} / {ledgerState.claim_limit.toString()}</strong></div></div><button className="button full-width" onClick={() => void operatorAction()} disabled={!isConnected || busy}>{busy ? <><Loader2 size={16} className="spin" />Proving…</> : ledgerState.room_open ? <><Pause size={16} />Lock space</> : <><Play size={16} />Open space</>}</button></div>}</> : <div className="empty-state"><Lock size={25} /><h2>Nothing deployed yet.</h2><p>Connect on {getNetwork()}, set a public rule, and approve the deployment. The explorer link will appear here after submission.</p></div>}
      <div className="disclosure"><details><summary>What this deployer actually does</summary><p>It loads the compiled <code>/managed</code> ZK assets, calls <code>createUnprovenDeployTx</code>, lets the wallet balance and submit it, then stores the resulting address. Submission is not confirmation; verify inclusion in the explorer.</p></details></div>
    </section></div><div className="honesty-note"><ShieldCheck size={15} /><p>Stillwater demonstrates selective disclosure with a self-attested score. It is not ready to gate real money, regulated access, or a production identity system without issuer-authenticated witnesses.</p></div></div>;
}
