// Subscription entitlement stub — replace with real tier check at subscription launch
export function canGenerateAudio(user: { id: string } | null): boolean {
  // TODO: check user.subscription_tier against allowed tiers
  // For beta: all authenticated users can generate audio
  return user !== null;
}
