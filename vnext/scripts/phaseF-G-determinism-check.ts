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

async function main() {
  const entrySolo = normalizeCampaignEntrySelection({ userId: 'u1', mode: 'solo' });
  const entryGroupChosen = normalizeCampaignEntrySelection({
    userId: 'u1',
    mode: 'group',
    formationMode: 'chosen',
    selectedMemberUserIds: ['u2', 'u3'],
  });
  if (entrySolo.seedMemberUserIds.length !== 1 || entrySolo.seedMemberUserIds[0] !== 'u1') {
    throw new Error('[PhaseE] normalizeCampaignEntrySelection solo mismatch');
  }
  if (entryGroupChosen.seedMemberUserIds.join(',') !== 'u1,u2,u3') {
    throw new Error('[PhaseE] normalizeCampaignEntrySelection chosen mismatch');
  }

  const profiles: Record<string, CharacterProfile> = {
    u1: mkChar('char_u1', 'fire'),
    u2: mkChar('char_u2', 'earth'),
    u3: mkChar('char_u3', 'air'),
  };

  const party1 = buildPartyProfile({
    id: 'party:u1:u2:u3',
    formationMode: 'chosen',
    memberUserIds: ['u1', 'u2', 'u3'],
    memberProfiles: profiles,
  });
  const party2 = buildPartyProfile({
    id: 'party:u1:u2:u3',
    formationMode: 'chosen',
    memberUserIds: ['u1', 'u2', 'u3'],
    memberProfiles: profiles,
  });
  if (JSON.stringify(party1) !== JSON.stringify(party2)) {
    throw new Error('[PhaseF] PartyProfile unstable for identical input');
  }

  const routing1 = buildPartyRoutingScore({ party: party1, domains: ['identity_heat', 'community_cohesion'] });
  const routing2 = buildPartyRoutingScore({ party: party1, domains: ['identity_heat', 'community_cohesion'] });
  if (JSON.stringify(routing1) !== JSON.stringify(routing2)) {
    throw new Error('[PhaseF] PartyRoutingScore unstable for identical input');
  }
  if (!('roleCoverageScore' in routing1) || !('elementalBalanceScore' in routing1)) {
    throw new Error('[PhaseF] PartyRoutingScore missing component fields');
  }

  const match1 = matchRoutedParty({
    initiatingUserId: 'u1',
    candidateUserIds: ['u2', 'u3'],
    memberProfiles: profiles,
    targetSize: 3,
    routingDomains: ['identity_heat', 'community_cohesion'],
  });
  const match2 = matchRoutedParty({
    initiatingUserId: 'u1',
    candidateUserIds: ['u2', 'u3'],
    memberProfiles: profiles,
    targetSize: 3,
    routingDomains: ['identity_heat', 'community_cohesion'],
  });
  if (!match1 || !match2) {
    throw new Error('[PhaseF] matchRoutedParty returned null');
  }
  if (JSON.stringify(match1) !== JSON.stringify(match2)) {
    throw new Error('[PhaseF] matchRoutedParty unstable for identical pool');
  }

  const field1 = buildGroupFieldProfile({ party: party1, memberProfiles: profiles });
  const field2 = buildGroupFieldProfile({ party: party1, memberProfiles: profiles });
  if (JSON.stringify(field1) !== JSON.stringify(field2)) {
    throw new Error('[PhaseG] GroupFieldProfile unstable for identical party');
  }
  if (!('collectivePressureDomains' in field1) || !('collectiveSupportDomains' in field1)) {
    throw new Error('[PhaseG] GroupFieldProfile missing collective domain fields');
  }

  // eslint-disable-next-line no-console
  console.log('[OK] PhaseE/F/G group determinism check passed', {
    entrySolo,
    entryGroupChosen,
    partyId: party1.id,
    routingTotal: routing1.total,
    groupThemes: field1.groupThemeBias,
    roleDistribution: party1.roleDistribution,
    collectivePressureDomains: field1.collectivePressureDomains,
  });
}

// eslint-disable-next-line no-console
main().catch((err) => {
  console.error('[phaseF-G-determinism-check] FAILED', err);
  process.exitCode = 1;
});

