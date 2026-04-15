import type { CampaignExpressionDigest, ProjectionOptions } from './projection-types';

/** Returns the digest only for campaign surface; otherwise undefined (callers must not rely on digest off-campaign). */
export function campaignExpressionDigestFromOptions(
  options: ProjectionOptions | undefined
): CampaignExpressionDigest | undefined {
  if (!options || options.surface !== 'campaign') return undefined;
  return options.campaignExpressionDigest;
}
