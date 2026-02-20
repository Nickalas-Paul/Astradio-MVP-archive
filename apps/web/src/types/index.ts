// === Core Data Contracts ===

export type ChartSummary = {
  id: string;
  label: string; // e.g., "My Natal" or "Today"
  createdAt: string;
  positions?: Record<string, number>;
  houses?: number[];
};

export type CompositionRequest = {
  chartA: string; // id
  chartB?: string; // id (optional for overlay)
  genre: 'classical' | 'jazz' | 'electronic' | 'house' | 'lofi' | 'ambient';
  durationSec: 30;
  seed?: string;
  controlHash?: string;
};

export type CompositionStatus =
  | { stage: 'queued' | 'preparing' | 'generating' | 'mixing'; pct: number }
  | { stage: 'ready'; id: string; url: string; layers: LayerMeta[]; audioHash?: string }
  | { stage: 'error'; code: string; message: string };

export type LayerMeta = {
  key: 'melody' | 'harmony' | 'rhythm' | 'texture';
  gain: number;
  muted?: boolean;
  solo?: boolean;
};

// === UI State Types ===

export type PlayerState = {
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  currentTrack?: {
    id: string;
    url: string;
    layers: LayerMeta[];
  };
};

export type CompositionJob = {
  id: string;
  request: CompositionRequest;
  status: CompositionStatus;
  createdAt: string;
  updatedAt: string;
};

export type AppState = {
  // Player state
  player: PlayerState;
  
  // Composition jobs
  currentJob?: CompositionJob;
  jobHistory: CompositionJob[];
  
  // Charts
  charts: ChartSummary[];
  activeChart?: string;
  
  // UI state
  sidebarOpen: boolean;
  theme: 'dark' | 'light';
  
  // Settings
  settings: {
    audioQuality: 'low' | 'standard' | 'high';
    language: 'en' | 'es';
    autoPlay: boolean;
  };
};

// === API Response Types ===

export type ChartData = {
  positions: Record<string, number>;
  cusps: number[];
  aspects: Array<{
    planet1: string;
    planet2: string;
    angle: number;
    type: string;
  }>;
  moonPhase: number;
  dominantElements: {
    fire: number;
    earth: number;
    air: number;
    water: number;
  };
};

export type AstroGuidance = {
  tempoBias: number;
  arcBias: number;
  densityBias: number;
  motifIdx: number;
  cadenceIdx: number;
};

export type ComposeResponse = {
  success: boolean;
  data?: {
    compositionId: string;
    audioUrl: string;
    layers: LayerMeta[];
    astroGuidance: AstroGuidance;
    studentV6: number[];
    modelVersion: string;
    modelSource: string;
  };
  error?: string;
  details?: {
    reason: string;
    code: string;
  };
};

// === Component Props Types ===

export type WheelCanvasProps = {
  chartData?: ChartData;
  isLoading?: boolean;
  onPlanetClick?: (planet: string) => void;
  className?: string;
};

export type TransportProps = {
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (time: number) => void;
  className?: string;
};

export type GenerateCardProps = {
  selectedGenre: string;
  onGenreChange: (genre: string) => void;
  onGenerate: (request: CompositionRequest) => void;
  isGenerating: boolean;
  className?: string;
};

export type LayerMixerProps = {
  layers: LayerMeta[];
  onLayerChange: (key: string, changes: Partial<LayerMeta>) => void;
  className?: string;
};

export type ComparisonSwitcherProps = {
  chartA: ChartSummary;
  chartB?: ChartSummary;
  onChartChange: (chartId: string, position: 'A' | 'B') => void;
  className?: string;
};

// === Error Types ===

export type AppError = {
  code: string;
  message: string;
  details?: string;
  retryable: boolean;
  timestamp: string;
};

// === Toast Types ===

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export type Toast = {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
};
