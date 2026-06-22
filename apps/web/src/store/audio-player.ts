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
  | 'dm';

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

  playTrack: (track: AudioTrack) => void;
  stop: () => void;
  togglePlayPause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;

  _setResolvedUrl: (url: string | null) => void;
  _setIsPlaying: (playing: boolean) => void;
  _setIsLoading: (loading: boolean) => void;
  _setCurrentTime: (time: number) => void;
  _setDuration: (duration: number) => void;
  _setError: (error: string | null) => void;
}

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
        }),

      togglePlayPause: () => {
        const { isPlaying, currentTrack } = get();
        if (!currentTrack) return;
        set({ isPlaying: !isPlaying });
      },

      seek: (time) => set({ currentTime: time }),
      setVolume: (volume) => set({ volume }),

      _setResolvedUrl: (url) => set({ resolvedUrl: url }),
      _setIsPlaying: (playing) => set({ isPlaying: playing }),
      _setIsLoading: (loading) => set({ isLoading: loading }),
      _setCurrentTime: (time) => set({ currentTime: time }),
      _setDuration: (duration) => set({ duration }),
      _setError: (error) => set({ error, isLoading: false }),
    }),
    {
      name: 'astradio-audio-player',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ volume: state.volume }),
    }
  )
);
