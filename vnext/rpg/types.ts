import type { EphemerisSnapshot, FeatureVec } from '../contracts';
import type { RPGEffectsBundle, RPGDomainScore } from './contracts';
import type { SemanticCore } from '../semantic/semantic-core';
import type { RPGCampaignState as InternalCampaignState } from './campaign/state-machine';

export interface CharacterTemperamentAxes {
  will: number;
  insight: number;
  attunement: number;
  courage: number;
  discipline: number;
  adaptability: number;
  bond: number;
  shadowCapacity: number;
  radiance: number;
}

export interface CharacterProfile {
  /** Deterministic identifier for this character profile, derived from natal snapshot hash + map version. */
  id: string;
  /** Direct bridge to existing RPG classing so Campaign stays aligned with other RPG surfaces. */
  classSlug: string;
  subclassSlug: string;
  risingModifierSlug: string;
  /** High-level chart identity flavor for Campaign surfaces. */
  primaryElement: 'fire' | 'earth' | 'air' | 'water';
  tonalPolarity: 'bright' | 'balanced' | 'dark';
  motionProfile: string;
  gravityProfile: string;
  luminaryWeight: 'sun' | 'moon' | 'balanced';
  dominantPlanets: string[];
  angularEmphasis: {
    first: boolean;
    fourth: boolean;
    seventh: boolean;
    tenth: boolean;
  };
  /** Normalized temperament axes in \[0,1], derived from natal structure. */
  temperament: CharacterTemperamentAxes;
  /** Top natal domains that seed Campaign focus (from RPGEffectsBundle.domainSummary). */
  signatureDomains: Array<{ domain: string; weight: number }>;
}

/** Alias to existing campaign state so Campaign uses a single canonical state representation. */
export type CampaignState = InternalCampaignState;

export type TransitPressureType =
  | 'constraint'
  | 'invitation'
  | 'conflict'
  | 'confusion'
  | 'revelation'
  | 'endurance'
  | 'restructuring'
  | 'release';

export interface TransitPressure {
  id: string;
  transitBody: string;
  natalBody: string;
  natalHouse: number;
  aspectType: string;
  /** Primary abstract domain for this pressure, derived from RPG transit domain mapping. */
  domain: string;
  /** Original phase1 family before challenge-layer compression. */
  pressureFamily: string;
  /** Coarse pressure classification for Campaign framing. */
  type: TransitPressureType;
  /** 0–1 normalized intensity (monotone in underlying domain score). */
  intensity: number;
  intensityBand: 'low' | 'moderate' | 'high' | 'critical';
  /** Symbolic life arena (e.g. identity, work, bond); derived from existing domain + house arena tags. */
  lifeArea: string;
  /** Deterministic hint about likely reactive pattern under this transit. */
  likelyShadowPattern: string;
  /** Deterministic hint about growth path / reframe. */
  growthPath: string;
  /** Group attribution when the pressure came from a specific member. */
  memberChartId?: string;
  /** Back-reference to contributing transit domain scores for debugging and explanation. */
  contributingDomains: RPGDomainScore[];
}

export type ResponsePosture =
  | 'observe'
  | 'assert'
  | 'engage'
  | 'withdraw'
  | 'support'
  | 'offer'
  | 'reframe'
  | 'contain';

export type ResponseModality =
  | 'reflective'
  | 'direct'
  | 'decisive'
  | 'protective'
  | 'relational'
  | 'restorative'
  | 'interpretive'
  | 'bounded';

export type OutcomeDirection =
  | 'assert_define'
  | 'engage_advance'
  | 'observe_hold'
  | 'withdraw_protect'
  | 'support_connect'
  | 'offer_restore'
  | 'reframe_integrate'
  | 'contain_limit';

export type ArchetypeId =
  | 'identity_test'
  | 'identity_definition'
  | 'resource_strain'
  | 'resource_opportunity'
  | 'signal_friction'
  | 'signal_reframe'
  | 'foundation_pressure'
  | 'foundation_repair'
  | 'creative_risk'
  | 'creative_devotion'
  | 'duty_pressure'
  | 'duty_alignment'
  | 'bond_friction'
  | 'bond_repair'
  | 'threshold_reckoning'
  | 'horizon_reorientation';

export type NatalBodyModifier =
  | 'core'
  | 'felt'
  | 'interpretive'
  | 'relational'
  | 'volitional'
  | 'expansive'
  | 'structural'
  | 'disruptive'
  | 'diffuse'
  | 'depth'
  | 'tender';

export interface ChoiceOption {
  id: string;
  /** Short verb phrase for UI; not moralized. */
  label: string;
  /** Symbolic description of what this choice represents. */
  symbolicGesture: string;
  /** Tagging for reflection layer (e.g. 'engage', 'pause', 'seek_counsel'). */
  patternTag: string;
  /** Stable semantic posture used across challenge and consequence layers. */
  posture: ResponsePosture;
  /** Surface description of how this posture approaches the challenge. */
  modality: ResponseModality;
  /** Stable risk/reward summary for player-facing explanation. */
  riskProfile: string;
  /** Deterministic consequence direction before domain-aware patch mapping. */
  outcomeDirection: OutcomeDirection;
}

export interface ChallengeScene {
  id: string;
  archetypeCategory?: string;
  archetypeId?: ArchetypeId;
  theme: string;
  /** Symbolic setting texture, not literal world-building. */
  setting: string;
  /** Core obstacle description framed as tension between pressure and character orientation. */
  obstacle: string;
  /** Transit node that most directly shaped this scene. */
  primaryPressure: TransitPressure;
  /** Additional pressures that colored the scene. */
  supportingPressures: TransitPressure[];
  /** Deterministic list of psychologically plausible responses. */
  choices: ChoiceOption[];
}

export interface ChallengeOutcome {
  /** Echoes the scene id for stable log linkage. */
  sceneId: string;
  /** The underlying choice that was taken. */
  choiceId: string;
  /** Human-readable narrative resolution. */
  narrative: string;
  /** Symbolic interpretation of what this pattern choice expresses under the active transit. */
  symbolicMeaning: string;
  /** Concrete reflection prompt or real-world lens. */
  realWorldReflection: string;
  /** Structural provenance back into the canonical pipeline. */
  provenance: {
    natalSnapshot: Pick<EphemerisSnapshot, 'ts' | 'tz' | 'lat' | 'lon'>;
    transitSnapshot: Pick<EphemerisSnapshot, 'ts' | 'tz' | 'lat' | 'lon'>;
    semantic_source_object_hash?: string;
    primaryDomain: string;
    lifeArea: string;
    pressureType: TransitPressureType;
    /** Which patternTag from the choice was activated (e.g. engage vs defer vs boundarize). */
    responsePatternTag: string;
  };
}

export interface CharacterBuilderInput {
  natalSnapshot: EphemerisSnapshot;
  featureVec: FeatureVec;
  effectsBundle: RPGEffectsBundle;
  semanticCore: SemanticCore;
  dominantPlanetNames: readonly string[];
}

