/**
 * Unified Profile natal identity anchor: one compose/control seed for all natal projections
 * (profile chart, personality, and any consumer of profile_natal canonical surface).
 */
import { createHash } from 'crypto';
import { snapshotFingerprint } from '../canonical/stable-json';
import type { EphemerisSnapshot } from '../contracts';

/** Stable string identity of natal ephemeris content (matches canonical participant natal_snapshot_hash field). */
export function profileNatalSnapshotFingerprint(snapshot: EphemerisSnapshot): string {
  return snapshotFingerprint(snapshot);
}

/** 64-hex anchor used as architecture seed, payload.hash, compose_seed, and control_surface_hash for profile_natal. */
export function profileNatalComposeAnchor(snapshot: EphemerisSnapshot): string {
  return createHash('sha256').update(profileNatalSnapshotFingerprint(snapshot), 'utf8').digest('hex');
}
