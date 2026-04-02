/**
 * Single natal projection path for Profile: architecture + ML explainer + profile_natal canonical hash.
 */
import { fetchChartSnapshot, generateArchitectureFromSnapshot, type ChartInput } from '../core/architecture-engine';
import { composeAPI } from '../api/compose';
import { controlPayloadFromSeed } from '../compat/payload-from-seed';
import { profileNatalComposeAnchor, profileNatalSnapshotFingerprint } from './profile-natal-anchor';
import type { EphemerisSnapshot } from '../contracts';
import type { ArchitectureOutput } from '../core/architecture-engine';

export const PROFILE_CONTRACT_VERSION = 1 as const;

export type ProfileNatalExplainerBundle = {
  snapshot: EphemerisSnapshot;
  architecture: ArchitectureOutput;
  anchor: string;
  natal_snapshot_fingerprint: string;
  explainer: Awaited<ReturnType<typeof composeAPI.getExplainerSectionsForFeatures>>;
};

export async function buildProfileNatalProjectionFromChartInput(chartInput: ChartInput): Promise<ProfileNatalExplainerBundle> {
  const snapshot = await fetchChartSnapshot(chartInput);
  const natal_snapshot_fingerprint = profileNatalSnapshotFingerprint(snapshot);
  const anchor = profileNatalComposeAnchor(snapshot);
  const architecture = await generateArchitectureFromSnapshot(snapshot, anchor);
  const payload = controlPayloadFromSeed(anchor);
  const explainer = await composeAPI.getExplainerSectionsForFeatures(
    architecture.features,
    payload,
    architecture.snapshot,
    architecture.guidance
  );
  return { snapshot, architecture, anchor, natal_snapshot_fingerprint, explainer };
}
