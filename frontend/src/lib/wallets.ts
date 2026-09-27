import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';

export type WalletType = '1am' | 'lace' | 'nightly' | 'other' | null;
export type CompatibleConnector = { connect(networkId: string): Promise<ConnectedAPI>; name?: string; apiVersion?: string; rdns?: string };
export type WalletEntry = { id: string; name: string; api: CompatibleConnector; type: Exclude<WalletType, null> };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isCompatibleConnector(value: unknown): value is CompatibleConnector {
  return record(value) && typeof value.connect === 'function';
}

function walletType(id: string, name: string): Exclude<WalletType, null> {
  const label = `${id} ${name}`.toLowerCase();
  if (label.includes('1am')) return '1am';
  if (label.includes('lace')) return 'lace';
  if (label.includes('nightly')) return 'nightly';
  return 'other';
}

/** Only inspect Midnight namespaces. A Cardano/EVM connect() is not a Midnight connector. */
export function detectWallets(injected: unknown): WalletEntry[] {
  if (!record(injected)) return [];
  const result: WalletEntry[] = [];
  const seen = new Set<unknown>();
  const add = (id: string, api: unknown) => {
    if (!isCompatibleConnector(api) || seen.has(api)) return;
    seen.add(api);
    const type = walletType(id, api.name || '');
    const fallback = type === '1am' ? '1AM Wallet' : type === 'lace' ? 'Lace Wallet' : type === 'nightly' ? 'Nightly Wallet' : id;
    result.push({ id, name: typeof api.name === 'string' && api.name.trim() ? api.name.slice(0, 80) : fallback, api, type });
  };
  if (record(injected.midnight)) {
    add('midnight', injected.midnight);
    for (const [id, api] of Object.entries(injected.midnight)) add(id, api);
  }
  // Some Nightly releases expose their Midnight connector below window.nightly.midnight.
  if (record(injected.nightly)) add('nightly', injected.nightly.midnight);
  return result;
}

export function listInjectedWallets(): WalletEntry[] {
  return typeof window === 'undefined' ? [] : detectWallets(window);
}

export function assertConnectedApi(api: unknown): asserts api is ConnectedAPI {
  const methods = ['getConfiguration', 'getShieldedAddresses', 'getUnshieldedAddress', 'getProvingProvider', 'balanceUnsealedTransaction', 'submitTransaction'];
  if (!record(api) || methods.some((name) => typeof api[name] !== 'function')) {
    throw new Error('This wallet does not support the current Midnight DApp connector. Update the wallet or choose a compatible 1AM, Lace, or Nightly connector.');
  }
}
