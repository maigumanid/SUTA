import NetInfo, {
  type NetInfoState,
} from '@react-native-community/netinfo';

export function isNetworkStateOnline(state: NetInfoState) {
  return (
    state.isConnected === true &&
    state.isInternetReachable !== false
  );
}

export async function getNetworkAvailability(): Promise<
  boolean | null
> {
  try {
    return isNetworkStateOnline(await NetInfo.fetch());
  } catch {
    return null;
  }
}
