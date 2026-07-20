import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type AudioSource =
  | 'identity'
  | 'transit'
  | 'sky'
  | 'connection'
  | 'sandbox'
  | 'forecast'
  | 'post'
  | 'dm'
  | 'game';

export interface AudioTrack {
  exportId: string;
  label: string;
  source: AudioSource;
}

interface AudioPlayerState {
  currentTrack: AudioTrack | null;
  resolvedUrl: string | null;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  error: string | null;
  /** FFT analyser from GlobalAudioPlayer; null until first successful wire-up. */
  analyserNode: AnalyserNode | null;
  /** Last sampled bass-weighted level (0–1); updated by Harmonic useFrame, not a store timer. */
  audioAnalyserLevel: number;

  playTrack: (track: AudioTrack) => void;
  stop: () => void;
  togglePlayPause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  /** Resume AudioContext after user gesture (play / Open Aura). */
  resumeAnalyserContext: () => Promise<void>;

  _setResolvedUrl: (url: string | null) => void;
  _setIsPlaying: (playing: boolean) => void;
  _setIsLoading: (loading: boolean) => void;
  _setCurrentTime: (time: number) => void;
  _setDuration: (duration: number) => void;
  _setError: (error: string | null) => void;
  _setAnalyserNode: (node: AnalyserNode | null) => void;
  _setAudioAnalyserLevel: (level: number) => void;
  _setAudioContext: (ctx: AudioContext | null) => void;
}

/** Held outside persisted state so AnalyserNode / AudioContext are never serialized. */
let audioContextRef: AudioContext | null = null;

export const useAudioPlayerStore = create<AudioPlayerState>()(
  persist(
    (set, get) => ({
      currentTrack: null,
      resolvedUrl: null,
      isPlaying: false,
      isLoading: false,
      currentTime: 0,
      duration: 0,
      volume: 0.8,
      error: null,
      analyserNode: null,
      audioAnalyserLevel: 0.5,

      playTrack: (track) => {
        const current = get().currentTrack;
        if (current?.exportId === track.exportId) {
          set({ isPlaying: true, error: null });
          return;
        }
        set({
          currentTrack: track,
          resolvedUrl: null,
          isPlaying: false,
          isLoading: true,
          currentTime: 0,
          duration: 0,
          error: null,
          audioAnalyserLevel: 0.5,
        });
      },

      stop: () =>
        set({
          currentTrack: null,
          resolvedUrl: null,
          isPlaying: false,
          isLoading: false,
          currentTime: 0,
          duration: 0,
          error: null,
          audioAnalyserLevel: 0.5,
        }),

      togglePlayPause: () => {
        const { isPlaying, currentTrack } = get();
        if (!currentTrack) return;
        set({ isPlaying: !isPlaying });
      },

      seek: (time) => set({ currentTime: time }),
      setVolume: (volume) => set({ volume }),

      resumeAnalyserContext: async () => {
        const ctx = audioContextRef;
        if (!ctx || ctx.state !== 'suspended') return;
        try {
          await ctx.resume();
        } catch {
          // Harmonic falls back to breathing sine.
        }
      },

      _setResolvedUrl: (url) => set({ resolvedUrl: url }),
      _setIsPlaying: (playing) => set({ isPlaying: playing }),
      _setIsLoading: (loading) => set({ isLoading: loading }),
      _setCurrentTime: (time) => set({ currentTime: time }),
      _setDuration: (duration) => set({ duration }),
      _setError: (error) => set({ error, isLoading: false }),
      _setAnalyserNode: (node) => set({ analyserNode: node }),
      _setAudioAnalyserLevel: (level) => set({ audioAnalyserLevel: level }),
      _setAudioContext: (ctx) => {
        audioContextRef = ctx;
      },
    }),
    {
      name: 'astradio-audio-player',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ volume: state.volume }),
    }
  )
);
