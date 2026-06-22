import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { AppState, PlayerState, CompositionJob, ChartSummary, Toast } from '../types';

export { useAudioPlayerStore } from './audio-player';
export type { AudioSource, AudioTrack } from './audio-player';

// === Player Store ===
interface PlayerStore extends PlayerState {
  // Actions
  setPlaying: (playing: boolean) => void;
  setPaused: (paused: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  setCurrentTrack: (track?: PlayerState['currentTrack']) => void;
  reset: () => void;
}

export const usePlayerStore = create<PlayerStore>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        isPlaying: false,
        isPaused: false,
        currentTime: 0,
        duration: 60,
        volume: 70,
        currentTrack: undefined,

        // Actions
        setPlaying: (playing) => set({ isPlaying: playing, isPaused: false }),
        setPaused: (paused) => set({ isPaused: paused, isPlaying: !paused }),
        setCurrentTime: (time) => set({ currentTime: time }),
        setDuration: (duration) => set({ duration }),
        setVolume: (volume) => set({ volume }),
        setCurrentTrack: (track) => set({ currentTrack: track }),
        reset: () => set({
          isPlaying: false,
          isPaused: false,
          currentTime: 0,
          duration: 60,
          currentTrack: undefined,
        }),
      }),
      {
        name: 'astradio-player',
        partialize: (state) => ({
          volume: state.volume,
        }),
      }
    ),
    { name: 'PlayerStore' }
  )
);

// Phase 8G: last natal compose result for profile soundtrack status (diagnostic, not persisted)
export type LastNatalComposeResult = {
  chartId: string;
  status: 'ok' | 'failed';
  provider_used: string | null;
  export_error: string | null;
  export_attempted: boolean;
  has_audio_payload: boolean;
};

// === Composition Store ===
interface CompositionStore {
  currentJob?: CompositionJob;
  jobHistory: CompositionJob[];
  lastNatalComposeResult: LastNatalComposeResult | null;

  // Actions
  setCurrentJob: (job?: CompositionJob) => void;
  updateJobStatus: (jobId: string, status: CompositionJob['status']) => void;
  addJobToHistory: (job: CompositionJob) => void;
  clearHistory: () => void;
  setLastNatalComposeResult: (r: LastNatalComposeResult | null) => void;
}

export const useCompositionStore = create<CompositionStore>()(
  devtools(
    persist(
      (set, get) => ({
        currentJob: undefined,
        jobHistory: [],
        lastNatalComposeResult: null,

        setCurrentJob: (job) => set({ currentJob: job }),
        setLastNatalComposeResult: (r) => set({ lastNatalComposeResult: r }),
        
        updateJobStatus: (jobId, status) => {
          const { currentJob, jobHistory } = get();
          
          if (currentJob?.id === jobId) {
            set({ currentJob: { ...currentJob, status, updatedAt: new Date().toISOString() } });
          }
          
          const updatedHistory = jobHistory.map(job =>
            job.id === jobId ? { ...job, status, updatedAt: new Date().toISOString() } : job
          );
          set({ jobHistory: updatedHistory });
        },
        
        addJobToHistory: (job) => {
          const { jobHistory } = get();
          set({ jobHistory: [job, ...jobHistory.slice(0, 49)] }); // Keep last 50 jobs
        },
        
        clearHistory: () => set({ jobHistory: [] }),
      }),
      {
        name: 'astradio-composition',
        // Phase 8G: blob URLs do not survive refresh; persist empty url so we re-fetch from exportId on load
        partialize: (state) => ({
          jobHistory: state.jobHistory.slice(0, 10).map((job) => {
            if (job.status.stage === 'ready' && typeof job.status.url === 'string' && job.status.url.startsWith('blob:')) {
              return { ...job, status: { ...job.status, url: '' } };
            }
            return job;
          }),
        }),
      }
    ),
    { name: 'CompositionStore' }
  )
);

// === Charts Store ===
interface ChartsStore {
  charts: ChartSummary[];
  activeChart?: string;
  
  // Actions
  setCharts: (charts: ChartSummary[]) => void;
  addChart: (chart: ChartSummary) => void;
  updateChart: (id: string, updates: Partial<ChartSummary>) => void;
  deleteChart: (id: string) => void;
  setActiveChart: (id?: string) => void;
}

export const useChartsStore = create<ChartsStore>()(
  devtools(
    persist(
      (set, get) => ({
        charts: [],
        activeChart: undefined,

        setCharts: (charts) => set({ charts }),
        
        addChart: (chart) => {
          const { charts } = get();
          set({ charts: [chart, ...charts] });
        },
        
        updateChart: (id, updates) => {
          const { charts } = get();
          set({
            charts: charts.map(chart =>
              chart.id === id ? { ...chart, ...updates } : chart
            ),
          });
        },
        
        deleteChart: (id) => {
          const { charts, activeChart } = get();
          set({
            charts: charts.filter(chart => chart.id !== id),
            activeChart: activeChart === id ? undefined : activeChart,
          });
        },
        
        setActiveChart: (id) => set({ activeChart: id }),
      }),
      {
        name: 'astradio-charts',
      }
    ),
    { name: 'ChartsStore' }
  )
);

// === UI Store ===
interface UIStore {
  sidebarOpen: boolean;
  theme: 'dark' | 'light';
  toasts: Toast[];
  
  // Actions
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const useUIStore = create<UIStore>()(
  devtools(
    persist(
      (set, get) => ({
        sidebarOpen: false,
        theme: 'dark',
        toasts: [],

        setSidebarOpen: (open) => set({ sidebarOpen: open }),
        
        setTheme: (theme) => set({ theme }),
        
        addToast: (toast) => {
          const id = Math.random().toString(36).substr(2, 9);
          const newToast = { ...toast, id };
          set({ toasts: [...get().toasts, newToast] });
          
          // Auto-remove toast after duration
          const duration = toast.duration || 5000;
          setTimeout(() => {
            get().removeToast(id);
          }, duration);
        },
        
        removeToast: (id) => {
          set({ toasts: get().toasts.filter(toast => toast.id !== id) });
        },
        
        clearToasts: () => set({ toasts: [] }),
      }),
      {
        name: 'astradio-ui',
        partialize: (state) => ({
          theme: state.theme,
        }),
      }
    ),
    { name: 'UIStore' }
  )
);

// === Settings Store ===
interface SettingsStore {
  settings: {
    audioQuality: 'low' | 'standard' | 'high';
    language: 'en' | 'es';
    autoPlay: boolean;
  };
  
  // Actions
  updateSettings: (updates: Partial<SettingsStore['settings']>) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  devtools(
    persist(
      (set) => ({
        settings: {
          audioQuality: 'standard',
          language: 'en',
          autoPlay: false,
        },

        updateSettings: (updates) => {
          set((state) => ({
            settings: { ...state.settings, ...updates },
          }));
        },
        
        resetSettings: () => {
          set({
            settings: {
              audioQuality: 'standard',
              language: 'en',
              autoPlay: false,
            },
          });
        },
      }),
      {
        name: 'astradio-settings',
      }
    ),
    { name: 'SettingsStore' }
  )
);

// === Combined App Store (for convenience) ===
export const useAppStore = () => ({
  player: usePlayerStore(),
  composition: useCompositionStore(),
  charts: useChartsStore(),
  ui: useUIStore(),
  settings: useSettingsStore(),
});
