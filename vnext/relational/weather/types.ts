/**
 * Stage 7 — Relational weather v1 types (deterministic structural state only).
 */

export type RelationalWeatherVersion = 'relational_weather_v1';

export type CrossAspectHitV1 = {
  transitBody: string;
  natalBody: string;
  memberChartId: string;
  type: 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';
  orbDeg: number;
  exactness: number;
  dynamics: 'amplifying' | 'supportive' | 'tense' | 'flowing' | 'polarizing';
  weight: number;
};

export type RelationalWeatherStateV1 = {
  version: RelationalWeatherVersion;
  stateHash: string;
  connection: {
    kind: 'pair' | 'group';
    bindingId: string;
    chartIdsOrdered: string[];
  };
  transit: {
    ts: string;
    tz: string;
    lat: number;
    lon: number;
    houseSystem: string;
  };
  activation: {
    harmony: number;
    friction: number;
    intensity: number;
    emotional_activation: number;
    communication_emphasis: number;
    volatility: number;
    growth_pressure: number;
  };
  score: {
    raw: number;
    significance: number;
  };
  aspects: {
    topCrossAspects: CrossAspectHitV1[];
    counts: {
      supportive: number;
      tense: number;
      amplifying: number;
      polarizing: number;
      flowing: number;
    };
  };
  themes: {
    dominantThemes: string[];
  };
};

/** Minimal feed / click-through contract (no UI). */
export type CommunityRelationalFeedItemV1 = {
  weatherVersion: RelationalWeatherVersion;
  kind: 'pair' | 'group';
  bindingId: string;
  chartIdsOrdered: string[];
  transit: RelationalWeatherStateV1['transit'];
  weather: {
    stateHash: string;
    activation: RelationalWeatherStateV1['activation'];
    score: RelationalWeatherStateV1['score'];
    themes: string[];
  };
};
