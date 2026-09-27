import { useCallback, useEffect, useRef, useState } from 'react';
import { ConfirmationTimeoutError, TransactionExecutionError, waitForConfirmation, type SubmittedTransaction, type TransactionProgress } from '../lib/contract';
import type { ConnectedSession } from '../lib/midnight';

export function useTransaction() {
  const [transaction, setTransaction] = useState<SubmittedTransaction | null>(null);
  const [status, setStatus] = useState<'idle' | 'working' | 'submitted' | 'confirmed' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [problem, setProblem] = useState('');
  const active = useRef(false);
  const mounted = useRef(true);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; controller.current?.abort(); window.dispatchEvent(new CustomEvent('stillwater:transaction-busy', { detail: false })); };
  }, []);
  const onProgress = useCallback((event: TransactionProgress) => { if (mounted.current) setMessage(event.message); }, []);
  const begin = () => {
    if (active.current) return false;
    active.current = true; controller.current = new AbortController();
    setProblem(''); setStatus('working');
    window.dispatchEvent(new CustomEvent('stillwater:transaction-busy', { detail: true }));
    return true;
  };
  const end = () => {
    active.current = false;
    window.dispatchEvent(new CustomEvent('stillwater:transaction-busy', { detail: false }));
  };
  const confirm = async (session: ConnectedSession, submitted: SubmittedTransaction, onConfirmed?: () => void | Promise<void>) => {
    await waitForConfirmation(session, submitted, { onProgress, timeoutMs: 120000, signal: controller.current?.signal });
    if (!mounted.current) return;
    await onConfirmed?.();
    setStatus('confirmed'); setMessage('Confirmed by the indexer. The entire transaction executed successfully.');
  };
  const handleError = (cause: unknown, submitted: SubmittedTransaction | null) => {
    if (!mounted.current) return;
    if (submitted && !(cause instanceof TransactionExecutionError)) {
      setStatus('submitted');
      setMessage('Submitted; confirmation is still unknown. Do not submit the same action again yet.');
      setProblem(cause instanceof ConfirmationTimeoutError ? 'The indexer did not confirm within two minutes. Check the explorer or retry confirmation.' : cause instanceof Error ? cause.message : 'The indexer could not confirm this transaction.');
    } else { setStatus('error'); setProblem(cause instanceof Error ? cause.message : 'The operation could not complete. Check the wallet and try again.'); setMessage(submitted ? 'The indexed transaction did not execute entirely.' : 'No successful submission was reported.'); }
  };
  const run = async (session: ConnectedSession, create: (options: { onProgress: (event: TransactionProgress) => void; signal?: AbortSignal }) => Promise<SubmittedTransaction>, onConfirmed?: (submitted: SubmittedTransaction) => void | Promise<void>) => {
    if (!begin()) return;
    let submitted: SubmittedTransaction | null = null;
    setTransaction(null);
    try {
      submitted = await create({ onProgress, signal: controller.current?.signal });
      if (!mounted.current) return;
      setTransaction(submitted);
      const current = submitted;
      await confirm(session, current, () => onConfirmed?.(current));
    } catch (cause) { handleError(cause, submitted); }
    finally { end(); }
  };
  const retryConfirmation = async (session: ConnectedSession, onConfirmed?: (submitted: SubmittedTransaction) => void | Promise<void>) => {
    if (!transaction || !begin()) return;
    try { await confirm(session, transaction, () => onConfirmed?.(transaction)); }
    catch (cause) { handleError(cause, transaction); }
    finally { end(); }
  };
  const clear = () => { if (!active.current) { setTransaction(null); setStatus('idle'); setMessage(''); setProblem(''); } };
  return { transaction, status, message, problem, run, retryConfirmation, clear, busy: status === 'working', pending: status === 'submitted' };
}
