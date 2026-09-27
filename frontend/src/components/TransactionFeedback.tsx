import { Check, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { getExplorerTxUrl } from '../config';
import type { useTransaction } from './useTransaction';

export function TransactionFeedback({ flow, onRetry }: { flow: ReturnType<typeof useTransaction>; onRetry?: () => void }) {
  if (flow.status === 'idle') return null;
  return <section className={`notice status-message ${flow.status === 'error' ? 'error' : flow.status === 'confirmed' ? 'success' : ''}`} role={flow.status === 'error' ? 'alert' : 'status'} aria-live="polite">
    <strong>{flow.busy ? <Loader2 size={15} className="spin" aria-hidden="true" /> : flow.status === 'confirmed' ? <Check size={15} aria-hidden="true" /> : null} {flow.message}</strong>
    {flow.problem && <p>{flow.problem}</p>}
    {flow.transaction && <><div className="address-block"><span>{flow.transaction.txId}</span></div><a className="text-link" href={getExplorerTxUrl(flow.transaction.txId, flow.transaction.network)} target="_blank" rel="noopener noreferrer">View {flow.transaction.network} transaction <ExternalLink size={14} /></a></>}
    {flow.pending && onRetry && <button className="button small" onClick={onRetry}><RefreshCw size={14} />Check confirmation again</button>}
  </section>;
}
