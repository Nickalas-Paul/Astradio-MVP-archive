import path from 'path';
import * as crypto from 'crypto';

function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

type EntitlementStorage = {
  getWebhookEvent: (provider: string, eventId: string) => Promise<{ processed_at?: Date | null } | null>;
  createWebhookEvent: (input: {
    id: string;
    provider: string;
    eventType: string;
    eventId: string;
    payload: unknown;
  }) => Promise<void>;
  markWebhookProcessed: (provider: string, eventId: string) => Promise<void>;
  getUserIdFromPlayPurchaseToken: (purchaseToken: string) => Promise<string | null>;
  updateSubscription: (
    userId: string,
    input: {
      status: string;
      provider: string;
      planId: string | null;
      externalId: string | null;
      startsAt: Date | null;
      expiresAt: Date | null;
      canceledAt: Date | null;
    }
  ) => Promise<void>;
  grantTokens: (
    userId: string,
    amount: number,
    reason: string,
    referenceId: string | null
  ) => Promise<number | null>;
};

function loadStorage(): EntitlementStorage {
  return require(path.join(process.cwd(), 'lib', 'pg-store.js')) as EntitlementStorage;
}

export async function handleGooglePlayNotification(message: { data: string; messageId: string }) {
  const decoded = JSON.parse(Buffer.from(message.data, 'base64').toString('utf-8'));
  const notification = decoded.subscriptionNotification || decoded.oneTimeProductNotification;

  if (!notification) return { status: 'ignored' };

  const storage = loadStorage();
  const existing = await storage.getWebhookEvent('google_play', message.messageId);
  if (existing?.processed_at) return { status: 'already_processed' };

  await storage.createWebhookEvent({
    id: generateId('wh'),
    provider: 'google_play',
    eventType: String(notification.notificationType),
    eventId: message.messageId,
    payload: decoded,
  });

  if (decoded.subscriptionNotification) {
    await handlePlaySubscription(decoded.subscriptionNotification);
  } else if (decoded.oneTimeProductNotification) {
    await handlePlayTokenPurchase(decoded.oneTimeProductNotification);
  }

  await storage.markWebhookProcessed('google_play', message.messageId);
  return { status: 'processed' };
}

async function handlePlaySubscription(notification: {
  subscriptionId: string;
  purchaseToken: string;
  notificationType: number;
}) {
  // TODO: verify with Google Play Developer API when service account is configured
  const storage = loadStorage();
  const userId = await storage.getUserIdFromPlayPurchaseToken(notification.purchaseToken);
  if (!userId) {
    console.warn('[Google Play] No user mapped to purchase token', notification.purchaseToken);
    return;
  }

  const statusMap: Record<number, string> = {
    1: 'active',
    2: 'active',
    3: 'canceled',
    4: 'active',
    5: 'past_due',
    6: 'past_due',
    7: 'active',
    12: 'canceled',
    13: 'canceled',
  };

  await storage.updateSubscription(userId, {
    status: statusMap[notification.notificationType] || 'none',
    provider: 'google_play',
    planId: notification.subscriptionId,
    externalId: notification.purchaseToken,
    startsAt: null,
    expiresAt: null,
    canceledAt: [3, 12, 13].includes(notification.notificationType) ? new Date() : null,
  });
}

async function handlePlayTokenPurchase(notification: {
  sku: string;
  purchaseToken: string;
  notificationType: number;
}) {
  if (notification.notificationType !== 1) return;

  const storage = loadStorage();
  const userId = await storage.getUserIdFromPlayPurchaseToken(notification.purchaseToken);
  if (!userId) return;

  const TOKEN_PACKS: Record<string, number> = {
    tokens_5: 5,
    tokens_15: 15,
    tokens_50: 50,
  };

  const tokenCount = TOKEN_PACKS[notification.sku] || 0;
  if (tokenCount > 0) {
    await storage.grantTokens(userId, tokenCount, 'purchase', notification.purchaseToken);
  }
}
