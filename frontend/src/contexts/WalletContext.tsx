import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createConnectedSession, type ConnectedSession } from '../lib/midnight';
import { assertConnectedApi, listInjectedWallets, type WalletEntry, type WalletType } from '../lib/wallets';
import { getNetwork, setNetwork, subscribeConfiguration, type Network } from '../config';
import { errorMessage } from '../lib/validation';

export { listInjectedWallets } from '../lib/wallets';
export type { WalletEntry, WalletType } from '../lib/wallets';
export type WalletStatus = 'checking' | 'detected' | 'not-found';
type WalletContextValue = {
  address: string | null;
  isConnected: boolean;
  walletType: WalletType;
  walletName: string | null;
  walletStatus: WalletStatus;
  isConnecting: boolean;
  session: ConnectedSession | null;
  availableWallets: WalletEntry[];
  error: string | null;
  clearError: () => void;
  connect: (network?: Network, walletId?: string) => Promise<ConnectedSession | undefined>;
  disconnect: () => void;
};
const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletStatus, setWalletStatus] = useState<WalletStatus>('checking');
  const [availableWallets, setAvailableWallets] = useState<WalletEntry[]>([]);
  const [walletType, setWalletType] = useState<WalletType>(null);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [session, setSession] = useState<ConnectedSession | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<ConnectedSession | null>(null);
  const mounted = useRef(false);
  const attempt = useRef(0);
  const connecting = useRef(false);
  const selectedNetwork = useRef(getNetwork());

  const clearError = useCallback(() => setError(null), []);
  const disconnect = useCallback(() => {
    attempt.current += 1;
    connecting.current = false;
    sessionRef.current?.disconnect();
    sessionRef.current = null;
    if (!mounted.current) return;
    setSession(null); setWalletName(null); setWalletType(null); setIsConnecting(false); setError(null);
  }, []);

  useEffect(() => {
    mounted.current = true;
    const started = Date.now();
    const detect = () => {
      const wallets = listInjectedWallets();
      setAvailableWallets((previous) => previous.length === wallets.length && previous.every((entry, i) => entry.id === wallets[i].id && entry.api === wallets[i].api) ? previous : wallets);
      setWalletStatus(wallets.length ? 'detected' : Date.now() - started < 6000 ? 'checking' : 'not-found');
    };
    detect();
    // Keep checking for delayed injection and newly installed/unlocked connectors.
    const timer = window.setInterval(detect, 1500);
    window.addEventListener('focus', detect);
    const unsubscribe = subscribeConfiguration(() => {
      const network = getNetwork();
      if (selectedNetwork.current !== network) { selectedNetwork.current = network; disconnect(); }
    });
    return () => {
      mounted.current = false;
      window.clearInterval(timer); window.removeEventListener('focus', detect); unsubscribe(); disconnect();
    };
  }, [disconnect]);

  const connect = useCallback(async (network: Network = getNetwork(), walletId?: string): Promise<ConnectedSession | undefined> => {
    if (connecting.current) return undefined;
    if (network !== getNetwork()) setNetwork(network);
    selectedNetwork.current = network;
    sessionRef.current?.disconnect();
    sessionRef.current = null;
    setSession(null); setWalletName(null); setWalletType(null);
    const currentAttempt = ++attempt.current;
    connecting.current = true; setIsConnecting(true); setError(null);
    let candidate: ConnectedSession | undefined;
    try {
      const wallets = listInjectedWallets();
      if (!wallets.length) throw new Error('Install and unlock a compatible Midnight 1AM, Lace, or Nightly wallet.');
      const chosen = walletId ? wallets.find((item) => item.id === walletId) : wallets[0];
      if (!chosen) throw new Error('The selected wallet is no longer available. Select another wallet.');
      const api = await chosen.api.connect(network);
      assertConnectedApi(api);
      if (!mounted.current || currentAttempt !== attempt.current || network !== getNetwork()) return undefined;
      candidate = await createConnectedSession(api, network);
      if (!mounted.current || currentAttempt !== attempt.current || network !== getNetwork()) { candidate.disconnect(); return undefined; }
      sessionRef.current = candidate;
      setSession(candidate); setWalletName(chosen.name); setWalletType(chosen.type); setError(null);
      return candidate;
    } catch (cause) {
      candidate?.disconnect();
      if (mounted.current && currentAttempt === attempt.current) {
        const message = errorMessage(cause, 'Wallet connection failed.');
        setError(/syncing/i.test(message) ? 'Your Midnight wallet is syncing. Open the extension and wait for it to finish, then retry.'
          : /rate limit/i.test(message) ? 'Your wallet is rate-limiting requests. Wait before retrying.' : message);
      }
      return undefined;
    } finally {
      if (mounted.current && currentAttempt === attempt.current) { connecting.current = false; setIsConnecting(false); }
    }
  }, []);

  return <WalletContext.Provider value={{ address: session?.unshieldedAddress ?? null, isConnected: Boolean(session), walletType, walletName, walletStatus, isConnecting, session, availableWallets, error, clearError, connect, disconnect }}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used inside WalletProvider');
  return context;
}
