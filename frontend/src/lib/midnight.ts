import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { createProofProvider } from '@midnight-ntwrk/midnight-js-types';
import type { MidnightProvider, PrivateStateProvider, PublicDataProvider, WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import type { ConnectedAPI, Configuration } from '@midnight-ntwrk/dapp-connector-api';
import { getNetworkConfig, type Network, type NetworkConfig } from '../config';
import { fromHex, normalizeHex, parseContractAddress, toHex } from './validation';

export { fromHex, toHex } from './validation';

function scopeAddress(address: string): string {
  return parseContractAddress(address);
}

type StoredState = unknown;
type StoredSigningKey = unknown;

/**
 * Browser-only private state. It intentionally has no persistence boundary: a reload clears it
 * unless the SDK itself has an application-specific recovery flow. Every state operation is
 * scoped to the currently selected contract address.
 */
export function createPrivateStateProvider(): PrivateStateProvider {
  let scope: string | null = null;
  const states = new Map<string, StoredState>();
  const signingKeys = new Map<string, StoredSigningKey>();
  const scopedKey = (id: string) => {
    if (!scope) throw new Error('Private state provider has no contract scope.');
    if (!id) throw new Error('Private state ID is required.');
    return `${scope}:${id}`;
  };
  const ensureAddress = (address: string) => scopeAddress(String(address));
  return {
    setContractAddress(address: string) { scope = ensureAddress(address); },
    async set(id: string, value: unknown) { states.set(scopedKey(id), value); },
    async get(id: string) { return states.get(scopedKey(id)) ?? null; },
    async remove(id: string) { states.delete(scopedKey(id)); },
    async clear() { states.clear(); },
    async setSigningKey(address: string, value: unknown) { signingKeys.set(ensureAddress(address), value); },
    async getSigningKey(address: string) { return signingKeys.get(ensureAddress(address)) ?? null; },
    async removeSigningKey(address: string) { signingKeys.delete(ensureAddress(address)); },
    async clearSigningKeys() { signingKeys.clear(); },
    // SDK export formats are encrypted and require a password. Do not offer a false plaintext export.
    async exportPrivateStates(): Promise<never> { throw new Error('Browser private-state export requires an explicit encrypted recovery flow.'); },
    async importPrivateStates(): Promise<never> { throw new Error('Browser private-state import requires an explicit encrypted recovery flow.'); },
    async exportSigningKeys(): Promise<never> { throw new Error('Browser signing-key export is disabled.'); },
    async importSigningKeys(): Promise<never> { throw new Error('Browser signing-key import is disabled.'); },
  } as PrivateStateProvider;
}

/** The SDK indexer provider is used directly so state reads and confirmation share one network. */
export function createPatchedPublicDataProvider(queryUrl: string, subscriptionUrl: string): PublicDataProvider {
  return indexerPublicDataProvider(queryUrl, subscriptionUrl) as PublicDataProvider;
}

export type SessionProviders = {
  privateStateProvider: PrivateStateProvider;
  publicDataProvider: PublicDataProvider;
  zkConfigProvider: FetchZkConfigProvider<string>;
  proofProvider: ReturnType<typeof createProofProvider>;
  walletProvider: WalletProvider;
  midnightProvider: MidnightProvider;
};

export type ConnectedSession = {
  api: ConnectedAPI;
  config: Configuration;
  network: Network;
  unshieldedAddress: string;
  providers: SessionProviders;
  disconnect: () => void;
};

function normalizeConnectorNetwork(value: unknown): Network | null {
  if (value === 'preview' || value === 'preprod') return value;
  return null;
}

export function assertSessionNetwork(config: Pick<Configuration, 'networkId'>, expected: Network): Network {
  const connected = normalizeConnectorNetwork(config.networkId);
  if (!connected) throw new Error(`Wallet returned unsupported Midnight network “${String(config.networkId)}”.`);
  if (connected !== expected) throw new Error(`Wallet is connected to ${connected}, but Stillwater is set to ${expected}. Select the same network in the wallet.`);
  return connected;
}

function configForSession(config: Configuration, expected: Network): NetworkConfig {
  assertSessionNetwork(config, expected);
  const selected = getNetworkConfig(expected);
  // The wallet's service configuration is authoritative when it is complete, but never allow a
  // malformed/missing value to silently redirect a session to a different network.
  if (!config.indexerUri || !config.indexerWsUri) throw new Error('Wallet did not provide indexer endpoints.');
  return { ...selected, indexerUrl: config.indexerUri, indexerWsUrl: config.indexerWsUri, rpcUrl: config.substrateNodeUri };
}

export async function createConnectedSession(api: ConnectedAPI, expectedNetwork: Network = 'preview'): Promise<ConnectedSession> {
  const config = await api.getConfiguration();
  const network = assertSessionNetwork(config, expectedNetwork);
  const networkConfig = configForSession(config, expectedNetwork);
  setNetworkId(network);
  const [unshielded, shielded] = await Promise.all([api.getUnshieldedAddress(), api.getShieldedAddresses()]);
  const zkConfigProvider = new FetchZkConfigProvider<string>(new URL(networkConfig.zkAssetPath, window.location.origin).toString(), window.fetch.bind(window));
  const provingProvider = await api.getProvingProvider(zkConfigProvider.asKeyMaterialProvider());
  const proofProvider = createProofProvider(provingProvider);
  const unwrapTransaction = (value: any): any => value && value.version && value.version !== 'v8' && value.tx ? value.tx : value;
  const walletProvider: WalletProvider = {
    getCoinPublicKey: () => shielded.shieldedCoinPublicKey,
    getEncryptionPublicKey: () => shielded.shieldedEncryptionPublicKey,
    balanceTx: async (versionedTx: any, ttl?: Date): Promise<any> => {
      // Older 4.x types pass a transaction directly; newer seam types tag it. Accept both while
      // always handing the connector a serialized v8-compatible transaction.
      void ttl;
      const tx = unwrapTransaction(versionedTx);
      if (!tx || typeof tx.serialize !== 'function') throw new Error('Wallet received an invalid unbound transaction.');
      const response = await api.balanceUnsealedTransaction(toHex(tx.serialize()));
      if (!response?.tx || typeof response.tx !== 'string') throw new Error('Wallet did not return a balanced transaction.');
      const { Transaction } = await import('@midnight-ntwrk/ledger-v8');
      const balanced = Transaction.deserialize('signature', 'proof', 'binding', fromHex(response.tx));
      return versionedTx?.version ? { version: versionedTx.version, tx: balanced } : balanced;
    },
  };
  const midnightProvider: MidnightProvider = {
    submitTx: async (versionedTx: any): Promise<string> => {
      const tx = unwrapTransaction(versionedTx);
      if (!tx || typeof tx.serialize !== 'function' || typeof tx.identifiers !== 'function') throw new Error('Wallet received an invalid finalized transaction.');
      const identifiers = tx.identifiers();
      if (!Array.isArray(identifiers) || typeof identifiers[0] !== 'string' || !identifiers[0]) throw new Error('Finalized transaction did not contain a transaction identifier.');
      await api.submitTransaction(toHex(tx.serialize()));
      return identifiers[0];
    },
  };
  const privateStateProvider = createPrivateStateProvider();
  let active = true;
  return {
    api, config, network, unshieldedAddress: unshielded.unshieldedAddress,
    providers: { privateStateProvider, publicDataProvider: createPatchedPublicDataProvider(networkConfig.indexerUrl, networkConfig.indexerWsUrl), zkConfigProvider, proofProvider, walletProvider, midnightProvider },
    disconnect: () => { if (!active) return; active = false; void privateStateProvider.clear(); void privateStateProvider.clearSigningKeys(); },
  };
}

export function parseTransactionId(value: string): string {
  const normalized = normalizeHex(value);
  if (!normalized) throw new Error('Transaction ID is empty.');
  return normalized;
}
