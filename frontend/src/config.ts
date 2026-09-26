import { isContractAddress, parseContractAddress } from './lib/validation';

export type Network = 'preview' | 'preprod';
export type NetworkConfig = {
  network: Network;
  networkId: Network;
  indexerUrl: string;
  indexerWsUrl: string;
  rpcUrl: string;
  explorerUrl: string;
  zkAssetPath: string;
};

const NETWORK_STORAGE_KEY = 'stillwater.network';
const ADDRESS_EVENT = 'stillwater:contract-address-changed';
const NETWORK_EVENT = 'stillwater:network-changed';
const ADDRESS_KEYS: Record<Network, string> = {
  preview: 'stillwater.contract-address.preview',
  preprod: 'stillwater.contract-address.preprod',
};

const NETWORK_CONFIGS: Record<Network, NetworkConfig> = {
  preview: {
    network: 'preview', networkId: 'preview',
    indexerUrl: 'https://indexer.preview.midnight.network/api/v4/graphql',
    indexerWsUrl: 'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
    rpcUrl: 'wss://rpc.preview.midnight.network',
    explorerUrl: 'https://preview.midnightexplorer.com',
    zkAssetPath: '/managed',
  },
  preprod: {
    network: 'preprod', networkId: 'preprod',
    indexerUrl: 'https://indexer.preprod.midnight.network/api/v4/graphql',
    indexerWsUrl: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
    rpcUrl: 'https://rpc.preprod.midnight.network',
    explorerUrl: 'https://preprod.midnightexplorer.com',
    zkAssetPath: '/managed',
  },
};

function configuredNetwork(value: unknown): Network | null {
  return value === 'preview' || value === 'preprod' ? value : null;
}

function readStorage(key: string): string | null {
  try { return typeof window === 'undefined' ? null : window.localStorage.getItem(key); } catch { return null; }
}

function runtimeEnv(): ImportMetaEnv {
  return ((import.meta as ImportMeta & { env?: ImportMetaEnv }).env || {}) as ImportMetaEnv;
}

function envNetwork(): Network {
  return configuredNetwork(runtimeEnv().VITE_NETWORK) || 'preview';
}

let activeNetwork: Network = configuredNetwork(readStorage(NETWORK_STORAGE_KEY)) || envNetwork();

export const DEFAULT_CLAIM_THRESHOLD = 72n;
export const DEFAULT_CLAIM_LIMIT = 144n;
export const CONTRACT_ADDRESS_CHANGED = ADDRESS_EVENT;
export const NETWORK_CHANGED = NETWORK_EVENT;

export function subscribeConfiguration(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(ADDRESS_EVENT, listener);
  window.addEventListener(NETWORK_EVENT, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(ADDRESS_EVENT, listener);
    window.removeEventListener(NETWORK_EVENT, listener);
    window.removeEventListener('storage', listener);
  };
}

export function getNetwork(): Network { return activeNetwork; }
export function getNetworkConfig(network: Network = activeNetwork): NetworkConfig {
  const base = { ...NETWORK_CONFIGS[network] };
  const env = runtimeEnv();
  const declaredNetwork = configuredNetwork(env.VITE_INDEXER_NETWORK) || envNetwork();
  if (declaredNetwork === network) {
    if (typeof env.VITE_INDEXER_URL === 'string' && env.VITE_INDEXER_URL.trim()) base.indexerUrl = env.VITE_INDEXER_URL.trim();
    if (typeof env.VITE_INDEXER_WS === 'string' && env.VITE_INDEXER_WS.trim()) base.indexerWsUrl = env.VITE_INDEXER_WS.trim();
  }
  return base;
}

/** Changes the app network; a wallet connected to another network must be disconnected by the UI. */
export function setNetwork(network: Network): Network {
  if (!configuredNetwork(network)) throw new Error('Stillwater supports Preview and Preprod only.');
  if (activeNetwork === network) return activeNetwork;
  activeNetwork = network;
  try { if (typeof window !== 'undefined') window.localStorage.setItem(NETWORK_STORAGE_KEY, network); } catch { /* memory still reflects the selection */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(NETWORK_EVENT, { detail: { network } }));
  return activeNetwork;
}

function envAddress(network: Network): string | null {
  const env = runtimeEnv();
  const scoped = env[`VITE_CONTRACT_ADDRESS_${network.toUpperCase()}`];
  if (typeof scoped === 'string' && scoped.trim()) return isContractAddress(scoped.trim()) ? scoped.trim().toLowerCase() : null;
  // A generic value is safe only when its explicitly declared network matches the active network.
  const generic = env.VITE_CONTRACT_ADDRESS;
  const declaredNetwork = configuredNetwork(env.VITE_CONTRACT_NETWORK);
  const sameConfiguredNetwork = declaredNetwork ? declaredNetwork === network : envNetwork() === network;
  return sameConfiguredNetwork && typeof generic === 'string' && isContractAddress(generic.trim())
    ? generic.trim().toLowerCase() : null;
}

export function getContractAddress(network: Network = activeNetwork): string {
  const stored = readStorage(ADDRESS_KEYS[network]);
  // A stored empty string is an explicit user clear and must not resurrect an env/previous address.
  if (stored !== null) return stored.trim() === '' ? '' : (isContractAddress(stored.trim()) ? stored.trim().toLowerCase() : '');
  return envAddress(network) || '';
}

export function setContractAddress(address: string, network: Network = activeNetwork): string {
  if (!configuredNetwork(network)) throw new Error('Unknown Stillwater network.');
  const trimmed = address.trim();
  const normalized = trimmed === '' ? '' : parseContractAddress(trimmed);
  try {
    // Keep an explicit empty sentinel so clearing an address cannot resurrect a build-time fallback.
    if (typeof window !== 'undefined') window.localStorage.setItem(ADDRESS_KEYS[network], normalized);
  } catch { /* caller still receives normalized address for this process */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(ADDRESS_EVENT, { detail: { network, address: normalized } }));
  return normalized;
}

export function getExplorerContractUrl(address = getContractAddress(), network: Network = activeNetwork): string {
  const base = getNetworkConfig(network).explorerUrl;
  if (!address) return base;
  return `${base}/contracts/${parseContractAddress(address)}`;
}

export function getExplorerTxUrl(txId: string, network: Network = activeNetwork): string {
  if (!txId || !/^[0-9a-f]+$/i.test(txId.trim())) throw new Error('Transaction ID must be hexadecimal.');
  return `${getNetworkConfig(network).explorerUrl}/transactions/${txId.trim()}`;
}

// Kept for existing consumers. New code should call getContractAddress() after network changes.
export const CONTRACT_ADDRESS = getContractAddress();
export const INDEXER_URL = getNetworkConfig().indexerUrl;
export const INDEXER_WS = getNetworkConfig().indexerWsUrl;
