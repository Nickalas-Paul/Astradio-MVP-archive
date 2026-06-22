import * as SecureStore from 'expo-secure-store';

const FTUE_KEYS = {
  todayWelcome: 'astradio_ftue_today_welcome',
  connectionsWelcome: 'astradio_ftue_connections_welcome',
  todayBridgeNudge: 'astradio_ftue_today_nudge',
} as const;

const SANDBOX_HINT_KEY_PREFIX = 'astradio_sandbox_hint_';

export function sandboxCardHintKey(journeyId: 'solo' | 'pair' | 'whatif' | 'group'): string {
  const keyId = journeyId === 'solo' ? 'single' : journeyId;
  return `${SANDBOX_HINT_KEY_PREFIX}${keyId}`;
}

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

export { FTUE_KEYS };
