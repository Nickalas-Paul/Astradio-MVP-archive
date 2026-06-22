import path from 'path';
import type { AudioGateResult, EntitlementRow } from './types';

type EntitlementStorage = {
  getOrCreateEntitlement: (userId: string) => Promise<EntitlementRow>;
  deductToken: (
    userId: string,
    opts: { reason: string; referenceId: string | null }
  ) => Promise<number | null>;
};

function loadStorage(): EntitlementStorage {
  return require(path.join(process.cwd(), 'lib', 'pg-store.js')) as EntitlementStorage;
}

export function isGateEnabled(): boolean {
  return process.env.ENTITLEMENT_GATE_ENABLED === 'true';
}

export function isActiveSubscriber(entitlement: EntitlementRow): boolean {
  if (entitlement.subscriptionStatus !== 'active' && entitlement.subscriptionStatus !== 'trialing') {
    return false;
  }
  if (entitlement.subscriptionExpiresAt) {
    const grace = 3 * 24 * 60 * 60 * 1000;
    if (Date.now() > entitlement.subscriptionExpiresAt.getTime() + grace) {
      return false;
    }
  }
  return true;
}

export function previewCanGenerateAudio(entitlement: EntitlementRow): boolean {
  if (!isGateEnabled()) return true;
  if (entitlement.betaTester) return true;
  if (isActiveSubscriber(entitlement)) return true;
  return entitlement.tokenBalance > 0;
}

/**
 * Single gate for all audio generation.
 * Call this before ANY Lyria pipeline invocation.
 */
export async function canGenerateAudio(userId: string): Promise<AudioGateResult> {
  if (!isGateEnabled()) {
    return { allowed: true, reason: 'gate_disabled' };
  }

  const storage = loadStorage();
  const entitlement = await storage.getOrCreateEntitlement(userId);

  if (entitlement.betaTester) {
    return { allowed: true, reason: 'beta_tester' };
  }

  if (isActiveSubscriber(entitlement)) {
    return { allowed: true, reason: 'subscriber' };
  }

  if (entitlement.tokenBalance > 0) {
    const newBalance = await storage.deductToken(userId, {
      reason: 'audio_compose',
      referenceId: null,
    });

    if (newBalance !== null) {
      return { allowed: true, reason: 'token', tokenBalanceAfter: newBalance };
    }
  }

  return {
    allowed: false,
    reason: 'no_entitlement',
    tokenBalance: entitlement.tokenBalance,
    subscriptionStatus: entitlement.subscriptionStatus,
  };
}

export async function getEntitlementMePayload(userId: string): Promise<{
  subscriptionStatus: string;
  tokenBalance: number;
  betaTester: boolean;
  canGenerateAudio: boolean;
  gateEnabled: boolean;
}> {
  const storage = loadStorage();
  const entitlement = await storage.getOrCreateEntitlement(userId);
  const gateEnabled = isGateEnabled();
  return {
    subscriptionStatus: entitlement.subscriptionStatus,
    tokenBalance: entitlement.tokenBalance,
    betaTester: entitlement.betaTester,
    canGenerateAudio: previewCanGenerateAudio(entitlement),
    gateEnabled,
  };
}
