import type { CharacterProfile } from './types';
import type { PartyProfile } from './party-types';
import { buildPartyProfile } from './party-profile';
import { buildPartyRoutingScore } from './party-scoring';

export interface CandidatePool {
  initiatingUserId: string;
  /** Other eligible userIds that can be combined with initiatingUserId. */
  candidateUserIds: string[];
  /** All character profiles keyed by userId, including initiating user. */
  memberProfiles: Record<string, CharacterProfile>;
  /** Target party size including initiating user. */
  targetSize: number;
  /** Deterministic list of routing domains to consider. */
  routingDomains: string[];
}

export interface PartyMatchResult {
  party: PartyProfile;
  score: number;
}

export function matchRoutedParty(pool: CandidatePool): PartyMatchResult | null {
  const { initiatingUserId, candidateUserIds, memberProfiles, targetSize, routingDomains } =
    pool;

  if (!initiatingUserId || !memberProfiles[initiatingUserId]) {
    throw new Error('initiatingUserId with CharacterProfile required');
  }

  const uniqueCandidates = Array.from(
    new Set(candidateUserIds.filter((id) => id !== initiatingUserId && memberProfiles[id]))
  ).sort();

  const size = Math.max(1, Math.min(targetSize, 1 + uniqueCandidates.length));

  let best: PartyMatchResult | null = null;

  const tryMembers = (memberUserIds: string[]) => {
    const partyId = ['party', ...memberUserIds].join(':');
    const profile = buildPartyProfile({
      id: partyId,
      formationMode: 'routed',
      memberUserIds,
      memberProfiles,
    });
    const routing = buildPartyRoutingScore({
      party: profile,
      domains: routingDomains,
    });
    const score = routing.total;

    if (!best || score > best.score || (score === best.score && partyId < best.party.id)) {
      best = { party: profile, score };
    }
  };

  const base = [initiatingUserId];
  if (size === 1) {
    tryMembers(base);
  } else {
    const k = size - 1;
    const n = uniqueCandidates.length;

    const idxs = Array.from({ length: k }, (_, i) => i);
    while (true) {
      const members = base.concat(idxs.map((i) => uniqueCandidates[i]));
      tryMembers(members);

      let pos = k - 1;
      while (pos >= 0 && idxs[pos] === n - k + pos) {
        pos--;
      }
      if (pos < 0) break;
      idxs[pos]++;
      for (let j = pos + 1; j < k; j++) {
        idxs[j] = idxs[j - 1] + 1;
      }
    }
  }

  return best;
}

