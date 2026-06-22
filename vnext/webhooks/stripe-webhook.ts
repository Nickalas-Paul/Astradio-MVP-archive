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

export async function handleStripeWebhook(rawBody: string, _signature: string) {
  // TODO: verify signature with stripe.webhooks.constructEvent when SDK is installed
  const event = JSON.parse(rawBody);
  const storage = loadStorage();

  const existing = await storage.getWebhookEvent('stripe', event.id);
  if (existing?.processed_at) return { status: 'already_processed' };

  await storage.createWebhookEvent({
    id: generateId('wh'),
    provider: 'stripe',
    eventType: event.type,
    eventId: event.id,
    payload: event.data,
  });

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object);
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object);
      break;
    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object);
      break;
  }

  await storage.markWebhookProcessed('stripe', event.id);
  return { status: 'processed' };
}

async function handleCheckoutCompleted(session: {
  metadata?: { astradio_user_id?: string; plan_id?: string; token_count?: string };
  mode?: string;
  subscription?: string;
  payment_intent?: string;
}) {
  const userId = session.metadata?.astradio_user_id;
  if (!userId) return;

  const storage = loadStorage();

  if (session.mode === 'subscription') {
    await storage.updateSubscription(userId, {
      status: 'active',
      provider: 'stripe',
      planId: session.metadata?.plan_id || null,
      externalId: session.subscription || null,
      startsAt: new Date(),
      expiresAt: null,
      canceledAt: null,
    });
  } else if (session.mode === 'payment') {
    const tokenCount = parseInt(session.metadata?.token_count || '0', 10);
    if (tokenCount > 0) {
      await storage.grantTokens(userId, tokenCount, 'purchase', session.payment_intent || null);
    }
  }
}

async function handleSubscriptionUpdated(subscription: {
  metadata?: { astradio_user_id?: string };
  status?: string;
  id?: string;
  items?: { data?: Array<{ price?: { id?: string } }> };
  current_period_start?: number;
  current_period_end?: number;
  canceled_at?: number | null;
}) {
  const userId = subscription.metadata?.astradio_user_id;
  if (!userId) return;

  const statusMap: Record<string, string> = {
    active: 'active',
    trialing: 'trialing',
    past_due: 'past_due',
    canceled: 'canceled',
    unpaid: 'past_due',
  };

  const storage = loadStorage();
  await storage.updateSubscription(userId, {
    status: statusMap[subscription.status || ''] || 'none',
    provider: 'stripe',
    planId: subscription.items?.data?.[0]?.price?.id || null,
    externalId: subscription.id || null,
    startsAt: subscription.current_period_start
      ? new Date(subscription.current_period_start * 1000)
      : null,
    expiresAt: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
    canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
  });
}

async function handleSubscriptionDeleted(subscription: {
  metadata?: { astradio_user_id?: string };
  id?: string;
  current_period_end?: number;
}) {
  const userId = subscription.metadata?.astradio_user_id;
  if (!userId) return;

  const storage = loadStorage();
  await storage.updateSubscription(userId, {
    status: 'canceled',
    provider: 'stripe',
    planId: null,
    externalId: subscription.id || null,
    startsAt: null,
    expiresAt: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
    canceledAt: new Date(),
  });
}

async function handlePaymentFailed(invoice: {
  metadata?: { astradio_user_id?: string };
  subscription?: string | null;
}) {
  const userId = invoice.metadata?.astradio_user_id || null;
  if (!userId) return;

  const storage = loadStorage();
  await storage.updateSubscription(userId, {
    status: 'past_due',
    provider: 'stripe',
    planId: null,
    externalId: invoice.subscription || null,
    startsAt: null,
    expiresAt: null,
    canceledAt: null,
  });
}
