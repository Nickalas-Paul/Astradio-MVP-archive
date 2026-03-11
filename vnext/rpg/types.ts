import type { EphemerisSnapshot, FeatureVec } from '../contracts';
import type { RPGEffectsBundle, RPGDomainScore } from './contracts';
import type { ChartSemanticProfile } from '../interpretation/chart-semantic-profile';
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
  primaryElement: ChartSemanticProfile['primaryElement'];
  tonalPolarity: ChartSemanticProfile['tonalPolarity'];
  motionProfile: ChartSemanticProfile['motionProfile'];
  gravityProfile: ChartSemanticProfile['gravityProfile'];
  luminaryWeight: ChartSemanticProfile['luminaryWeight'];
  dominantPlanets: string[];
  angularEmphasis: ChartSemanticProfile['angularEmphasis'];
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
  /** Primary abstract domain for this pressure, derived from RPG transit domain mapping. */
  domain: string;
  /** Coarse pressure classification for Campaign framing. */
  type: TransitPressureType;
  /** 0–1 normalized intensity (monotone in underlying domain score). */
  intensity: number;
  /** Symbolic life arena (e.g. identity, work, bond); derived from existing domain + house arena tags. */
  lifeArea: string;
  /** Deterministic hint about likely reactive pattern under this transit. */
  likelyShadowPattern: string;
  /** Deterministic hint about growth path / reframe. */
  growthPath: string;
  /** Back-reference to contributing transit domain scores for debugging and explanation. */
  contributingDomains: RPGDomainScore[];
}

export interface ChoiceOption {
  id: string;
  /** Short verb phrase for UI; not moralized. */
  label: string;
  /** Symbolic description of what this choice represents. */
  symbolicGesture: string;
  /** Tagging for reflection layer (e.g. 'engage', 'pause', 'seek_counsel'). */
  patternTag: string;
}

export interface ChallengeScene {
  id: string;
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
    semanticProfileEnergySignature?: string;
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
  semanticProfile: ChartSemanticProfile;
}

