import type { CampaignExpressionDigest, ProjectionOptions } from './projection-types';

/**
 * Returns the digest only for campaign surface; otherwise undefined (callers must not rely on digest off-campaign).
 * Lens + progression for projection must come only from `campaignExpressionDigest` on campaign surface (`campaign-lens-contract.ts`).
 */
export function campaignExpressionDigestFromOptions(
  options: ProjectionOptions | undefined
): CampaignExpressionDigest | undefined {
  if (!options || options.surface !== 'campaign') return undefined;
  return options.campaignExpressionDigest;
}
