import { useCallback, useSyncExternalStore } from 'react';
import { getContractAddress, getNetwork, getNetworkConfig, setContractAddress, setNetwork, subscribeConfiguration, type Network } from '../config';

/** Stable primitive snapshots prevent useSyncExternalStore update loops. */
export function useDeployment() {
  const network = useSyncExternalStore(subscribeConfiguration, getNetwork, () => 'preview' as Network);
  const address = useSyncExternalStore(subscribeConfiguration, () => getContractAddress(network), () => '');
  const setAddress = useCallback((value: string) => setContractAddress(value, network), [network]);
  return { network, address, config: getNetworkConfig(network), setAddress, setNetwork };
}
