#!/usr/bin/env node
/**
 * Pass 5 — Stress and determinism guard for party matching and group field.
 * Same messy inputs → same normalized group; same pool → same routed result; same party → same group field.
 */

import type { CharacterProfile } from '../rpg/types';
import { normalizeCampaignEntrySelection } from '../rpg/campaign-entry';
import { buildPartyProfile } from '../rpg/party-profile';
import { buildPartyRoutingScore } from '../rpg/party-scoring';
import { matchRoutedParty } from '../rpg/party-matching';
import { buildGroupFieldProfile } from '../rpg/group-field';

function mkChar(id: string, primaryElement: CharacterProfile['primaryElement']): CharacterProfile {
  return {
    id,
    classSlug: 'class_fire',
    subclassSlug: 'subclass_core',
    risingModifierSlug: 'rising_1',
    primaryElement,
    tonalPolarity: 'balanced',
    motionProfile: 'steady',
    gravityProfile: 'balanced',
    luminaryWeight: 'sun',
    dominantPlanets: [],
    angularEmphasis: { first: true, fourth: false, seventh: false, tenth: false },
    temperament: {
      will: 0.8,
      insight: 0.5,
      attunement: 0.6,
      courage: 0.7,
      discipline: 0.6,
      adaptability: 0.4,
      bond: 0.6,
      shadowCapacity: 0.5,
      radiance: 0.7,
    },
    signatureDomains: [
      { domain: 'identity_heat', weight: 0.8 },
      { domain: 'community_cohesion', weight: 0.4 },
    ],
    statBlock: {
      vitality: 10,
      resilience: 10,
      cunning: 10,
      charm: 10,
      intuition: 10,
      willpower: 10,
    },
    statTrace: {
      raw: {
        vitality: 10,
        resilience: 10,
        cunning: 10,
        charm: 10,
        intuition: 10,
        willpower: 10,
      },
      final: {
        vitality: 10,
        resilience: 10,
        cunning: 10,
        charm: 10,
        intuition: 10,
        willpower: 10,
      },
      perPlanet: {},
      aspectBonuses: [],
    },
  };
}

const EXPECTED_CHOSEN = ['leader_1', 'member_a', 'member_b'];

function stressChosenNormalization(): void {
  const inputs: Array<{ userId: string; selectedMemberUserIds: string[] }> = [
    { userId: 'leader_1', selectedMemberUserIds: ['leader_1', 'member_b', 'member_a', 'member_a'] },
    { userId: 'leader_1', selectedMemberUserIds: ['member_a', 'member_b', 'leader_1'] },
    { userId: 'leader_1', selectedMemberUserIds: ['member_b', 'member_a', 'leader_1', 'leader_1'] },
  ];

  for (const { userId, selectedMemberUserIds } of inputs) {
    const entry = normalizeCampaignEntrySelection({
      userId,
      mode: 'group',
      formationMode: 'chosen',
      selectedMemberUserIds,
    });
    if (JSON.stringify(entry.seedMemberUserIds) !== JSON.stringify(EXPECTED_CHOSEN)) {
      throw new Error(
        `Chosen stress: expected ${EXPECTED_CHOSEN} got ${JSON.stringify(entry.seedMemberUserIds)} for ${JSON.stringify(selectedMemberUserIds)}`
      );
    }
  }
}

function stressRoutedMatching(profiles: Record<string, CharacterProfile>): void {
  const pool1 = {
    initiatingUserId: 'u1',
    candidateUserIds: ['u2', 'u3', 'u2', 'u3', 'u2'],
    memberProfiles: profiles,
    targetSize: 3,
    routingDomains: ['community_cohesion', 'identity_heat'],
  };
  const pool2 = {
    initiatingUserId: 'u1',
    candidateUserIds: ['u3', 'u2'],
    memberProfiles: profiles,
    targetSize: 3,
    routingDomains: ['identity_heat', 'community_cohesion'],
  };

  const match1a = matchRoutedParty(pool1);
  const match1b = matchRoutedParty(pool1);
  const match2a = matchRoutedParty(pool2);
  const match2b = matchRoutedParty(pool2);

  if (JSON.stringify(match1a) !== JSON.stringify(match1b)) {
    throw new Error('Routed stress: same pool (with duplicates) → different match');
  }
  if (JSON.stringify(match2a) !== JSON.stringify(match2b)) {
    throw new Error('Routed stress: same pool (different domain order) → different match');
  }
}

function stressPartyAndGroupField(profiles: Record<string, CharacterProfile>): void {
  const memberUserIds = ['u1', 'u2', 'u3'];
  const partyId = ['party', ...memberUserIds].join(':');

  const party1 = buildPartyProfile({
    id: partyId,
    formationMode: 'chosen',
    memberUserIds,
    memberProfiles: profiles,
  });
  const party2 = buildPartyProfile({
    id: partyId,
    formationMode: 'chosen',
    memberUserIds,
    memberProfiles: profiles,
  });

  if (JSON.stringify(party1) !== JSON.stringify(party2)) {
    throw new Error('Party stress: same inputs → different profile');
  }

  const field1 = buildGroupFieldProfile({ party: party1, memberProfiles: profiles });
  const field2 = buildGroupFieldProfile({ party: party1, memberProfiles: profiles });

  if (JSON.stringify(field1) !== JSON.stringify(field2)) {
    throw new Error('Group field stress: same party → different group field');
  }
}

function main(): void {
  stressChosenNormalization();

  const profiles: Record<string, CharacterProfile> = {
    u1: mkChar('char_u1', 'fire'),
    u2: mkChar('char_u2', 'earth'),
    u3: mkChar('char_u3', 'air'),
  };

  stressRoutedMatching(profiles);
  stressPartyAndGroupField(profiles);

  // eslint-disable-next-line no-console
  console.log('OK: party matching and group field are stable under stress (chosen, routed, party, group field)');
}

main();
