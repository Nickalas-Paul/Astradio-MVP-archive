/**
 * Canonical plan hashing for deterministic plan identity
 * Ensures same plan always produces same hash regardless of object order or float precision
 */

import * as crypto from 'crypto';
import type { Plan, EventToken } from './contracts';

/**
 * Round time values to 1ms precision to avoid float jitter
 */
function roundTime(t: number): number {
  return Math.round(t * 1000) / 1000;
}

/**
 * Canonical event comparator for deterministic sorting:
 * (t0 asc) then (channel asc) then (pitch asc) then (t1 asc) then (velocity asc) then (group asc or empty string)
 */
function compareEvents(a: EventToken, b: EventToken): number {
  const t0Diff = roundTime(a.t0) - roundTime(b.t0);
  if (t0Diff !== 0) return t0Diff;
  
  const channelDiff = a.channel.localeCompare(b.channel);
  if (channelDiff !== 0) return channelDiff;
  
  const pitchDiff = a.pitch - b.pitch;
  if (pitchDiff !== 0) return pitchDiff;
  
  const t1Diff = roundTime(a.t1) - roundTime(b.t1);
  if (t1Diff !== 0) return t1Diff;
  
  const velDiff = a.velocity - b.velocity;
  if (velDiff !== 0) return velDiff;
  
  const groupA = a.group || '';
  const groupB = b.group || '';
  return groupA.localeCompare(groupB);
}

/**
 * Canonicalize plan to a stable JSON-serializable object
 */
export function canonicalizePlan(plan: Plan): any {
  // Sort events deterministically
  const sortedEvents = [...plan.events].sort(compareEvents).map(ev => ({
    t0: roundTime(ev.t0),
    t1: roundTime(ev.t1),
    pitch: ev.pitch,
    velocity: ev.velocity,
    channel: ev.channel,
    group: ev.group || undefined // Omit if empty
  }));

  return {
    id: plan.id,
    featureHash: plan.featureHash,
    durationSec: roundTime(plan.durationSec),
    bpm: plan.bpm,
    key: plan.key,
    events: sortedEvents
  };
}

/**
 * Compute SHA256 hash of canonicalized plan
 */
export function computePlanHash(plan: Plan): string {
  const canonical = canonicalizePlan(plan);
  const json = JSON.stringify(canonical);
  return crypto.createHash('sha256').update(json, 'utf8').digest('hex');
}
