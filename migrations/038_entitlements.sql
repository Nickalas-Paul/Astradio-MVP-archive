-- User entitlement state
CREATE TABLE IF NOT EXISTS astradio_entitlements (
  user_id TEXT PRIMARY KEY,

  -- Subscription state
  subscription_status TEXT NOT NULL DEFAULT 'none',
  subscription_provider TEXT,
  subscription_plan_id TEXT,
  subscription_external_id TEXT,
  subscription_started_at TIMESTAMPTZ,
  subscription_expires_at TIMESTAMPTZ,
  subscription_canceled_at TIMESTAMPTZ,

  -- Token balance (metered usage)
  token_balance INTEGER NOT NULL DEFAULT 0,
  tokens_granted_total INTEGER NOT NULL DEFAULT 0,
  tokens_used_total INTEGER NOT NULL DEFAULT 0,

  -- Tier tracking
  free_tier_granted BOOLEAN NOT NULL DEFAULT FALSE,
  beta_tester BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Token transaction log (audit trail)
CREATE TABLE IF NOT EXISTS astradio_token_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  balance_after INTEGER NOT NULL,
  reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Webhook event log (idempotency)
CREATE TABLE IF NOT EXISTS astradio_webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_entitlements_status ON astradio_entitlements(subscription_status);
CREATE INDEX IF NOT EXISTS idx_entitlements_beta ON astradio_entitlements(beta_tester) WHERE beta_tester = TRUE;
CREATE INDEX IF NOT EXISTS idx_token_transactions_user ON astradio_token_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider ON astradio_webhook_events(provider, event_id);
