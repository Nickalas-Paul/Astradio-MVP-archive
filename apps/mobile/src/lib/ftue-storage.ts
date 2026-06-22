import * as SecureStore from 'expo-secure-store';

const FTUE_KEYS = {
  todayWelcome: 'astradio_ftue_today_welcome',
  connectionsWelcome: 'astradio_ftue_connections_welcome',
  todayBridgeNudge: 'astradio_ftue_today_nudge',
  sandboxVisits: 'astradio_sandbox_visits',
} as const;

export async function isFtueDismissed(key: string): Promise<boolean> {
  try {
    const val = await SecureStore.getItemAsync(key);
    return val === 'dismissed';
  } catch {
    return false;
  }
}

export async function dismissFtue(key: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, 'dismissed');
  } catch {
    // silent
  }
}

export async function incrementSandboxVisitCount(): Promise<{ showHints: boolean }> {
  try {
    const visits = parseInt((await SecureStore.getItemAsync(FTUE_KEYS.sandboxVisits)) || '0', 10);
    await SecureStore.setItemAsync(FTUE_KEYS.sandboxVisits, String(visits + 1));
    return { showHints: visits < 2 };
  } catch {
    return { showHints: false };
  }
}

export { FTUE_KEYS };
