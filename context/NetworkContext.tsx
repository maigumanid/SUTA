import NetInfo from '@react-native-community/netinfo';
import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { isNetworkStateOnline } from '@/utils/networkState';

type NetworkContextValue = { isOnline: boolean | null };
const NetworkContext = createContext<NetworkContextValue | null>(null);

export function NetworkProvider({ children }: PropsWithChildren) {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  useEffect(() => NetInfo.addEventListener((state) => {
    setIsOnline(state.isConnected === null ? null : isNetworkStateOnline(state));
  }), []);

  const value = useMemo(() => ({ isOnline }), [isOnline]);
  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  const value = useContext(NetworkContext);
  if (!value) throw new Error('useNetwork must be used inside NetworkProvider.');
  return value;
}
