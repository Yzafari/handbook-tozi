import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';
import * as Network from 'expo-network';
import { runSync } from './transport';

const FOREGROUND_SYNC_INTERVAL_MS = 60_000;

/**
 * Start a low-frequency foreground sync for the authenticated account.
 * Call the returned cleanup function on logout or when the account changes.
 * The outbox remains durable if the device is offline or the app is closed.
 */
export function startAutoSync(userId: string) {
  let active = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
  let online = false;
  let running = false;
  const sync = async () => {
    if (!active || !online || running) return;
    running = true;
    try { await runSync(userId); } finally { running = false; }
  };
  const refreshNetwork = async () => {
    const state = await Network.getNetworkStateAsync().catch(() => null);
    online = state?.isConnected === true && state.isInternetReachable !== false;
    if (online) await sync();
  };
  const appSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
    active = state === 'active';
    if (active) void refreshNetwork();
  });
  const networkSubscription = Network.addNetworkStateListener(state => {
    online = state.isConnected === true && state.isInternetReachable !== false;
    if (online && active) void sync();
  });
  const interval = setInterval(() => { void sync(); }, FOREGROUND_SYNC_INTERVAL_MS);
  void refreshNetwork();
  return () => { clearInterval(interval); appSubscription.remove(); networkSubscription.remove(); };
}
