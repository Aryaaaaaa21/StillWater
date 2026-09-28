import { useCallback, useEffect, useRef, useState } from 'react';
import { ledger, type Ledger } from '../managed/contract/index.js';
import { getContractAddress, getNetwork, getNetworkConfig } from '../config';
import { createPatchedPublicDataProvider } from '../lib/midnight';
import { errorMessage, parseContractAddress } from '../lib/validation';
import { useDeployment } from './useDeployment';

const providers = new Map<string, ReturnType<typeof createPatchedPublicDataProvider>>();
function getProvider(network: ReturnType<typeof getNetwork>) {
  const config = getNetworkConfig(network);
  const key = `${config.indexerUrl}|${config.indexerWsUrl}`;
  let provider = providers.get(key);
  if (!provider) { provider = createPatchedPublicDataProvider(config.indexerUrl, config.indexerWsUrl); providers.set(key, provider); }
  return provider;
}

type Snapshot = { key: string; ledgerState: Ledger | null; isLoading: boolean; error: string | null; lastUpdate: Date | null };

export function useContractState(interval = 5000, requestedAddress?: string) {
  const deployment = useDeployment();
  const address = requestedAddress ?? deployment.address;
  const network = deployment.network;
  const key = `${network}:${address}`;
  const selected = useRef(key);
  selected.current = key;
  const generation = useRef(0);
  const alive = useRef(false);
  const inFlight = useRef<{ key: string; request: Promise<void> } | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>({ key, ledgerState: null, isLoading: Boolean(address), error: null, lastUpdate: null });

  const refetch = useCallback((): Promise<void> => {
    if (inFlight.current?.key === key) return inFlight.current.request;
    const version = ++generation.current;
    const current = () => alive.current && selected.current === key && generation.current === version
      && getNetwork() === network && (requestedAddress !== undefined || getContractAddress(network) === address);
    const request = (async () => {
      if (!address) {
        if (current()) setSnapshot({ key, ledgerState: null, isLoading: false, error: null, lastUpdate: null });
        return;
      }
      if (current()) setSnapshot((previous) => ({ key, ledgerState: previous.key === key ? previous.ledgerState : null, lastUpdate: previous.key === key ? previous.lastUpdate : null, isLoading: true, error: null }));
      try {
        const state = await getProvider(network).queryContractState(parseContractAddress(address));
        if (current()) setSnapshot({ key, ledgerState: state ? ledger(state.data) : null, isLoading: false, error: null, lastUpdate: new Date() });
      } catch (cause) {
        if (current()) setSnapshot((previous) => ({ key, ledgerState: previous.key === key ? previous.ledgerState : null, lastUpdate: previous.key === key ? previous.lastUpdate : null, isLoading: false, error: errorMessage(cause, 'Unable to read the Midnight indexer.') }));
      }
    })();
    inFlight.current = { key, request };
    void request.finally(() => { if (inFlight.current?.request === request) inFlight.current = null; });
    return request;
  }, [address, key, network, requestedAddress]);

  useEffect(() => {
    alive.current = true;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      await refetch();
      if (!stopped && interval > 0) timer = setTimeout(() => void poll(), Math.max(1000, interval));
    };
    void poll();
    return () => { stopped = true; alive.current = false; generation.current += 1; inFlight.current = null; if (timer) clearTimeout(timer); };
  }, [refetch, interval]);

  const visible = snapshot.key === key ? snapshot : { ledgerState: null, isLoading: Boolean(address), error: null, lastUpdate: null };
  // Keep the legacy UI surface permissive: generated ledger shapes vary slightly between SDK releases.
  return { ledgerState: visible.ledgerState as any, isLoading: visible.isLoading, error: visible.error, lastUpdate: visible.lastUpdate, refetch };
}
