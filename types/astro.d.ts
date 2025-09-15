export type Degree = number; // 0..360 normalized elsewhere

export type PlanetName =
  | "Sun"|"Moon"|"Mercury"|"Venus"|"Mars"|"Jupiter"|"Saturn"|"Uranus"|"Neptune"|"Pluto"
  | "ASC"|"MC";

export type LunarPhase = 'new'|'waxing'|'full'|'waning';

export interface PlanetPosition {
  lon: Degree;         // ecliptic longitude 0..360
  lat?: number;
  speed?: number;
  house?: 1|2|3|4|5|6|7|8|9|10|11|12;
  sign?: string;
}

export interface AspectData {
  type: string;
  target: string;
  angle: number;
  orb: number;
}

export interface Cluster {
  id: string;
  planets: string[];
  startHouse: number;
  endHouse: number;
  centroidAngle: number;
}

export interface ChartAnalysis {
  clusters: Cluster[];
  dominantElements: { fire: number; earth: number; air: number; water: number };
  moonPhase: LunarPhase;
  moonSign: string;
}

export interface ChartData {
  positions: Partial<Record<PlanetName, PlanetPosition>>;
  cusps: Record<1|2|3|4|5|6|7|8|9|10|11|12, Degree>; // Placidus
  seed?: number;
  analysis: ChartAnalysis;
}
