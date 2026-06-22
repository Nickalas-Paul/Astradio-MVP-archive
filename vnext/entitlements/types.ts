export type EntitlementRow = {
  userId: string;
  subscriptionStatus: string;
  subscriptionProvider: string | null;
  subscriptionPlanId: string | null;
  subscriptionExternalId: string | null;
  subscriptionStartedAt: Date | null;
  subscriptionExpiresAt: Date | null;
  subscriptionCanceledAt: Date | null;
  tokenBalance: number;
  tokensGrantedTotal: number;
  tokensUsedTotal: number;
  freeTierGranted: boolean;
  betaTester: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AudioGateResult =
  | { allowed: true; reason: 'gate_disabled' | 'beta_tester' | 'subscriber' | 'token'; tokenBalanceAfter?: number }
  | { allowed: false; reason: 'no_entitlement'; tokenBalance: number; subscriptionStatus: string };
