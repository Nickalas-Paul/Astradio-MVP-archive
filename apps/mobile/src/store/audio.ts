import { create } from 'zustand';

export type AudioSource = 'identity' | 'transit' | 'connection' | 'sandbox' | 'post' | 'dm';

export interface AudioTrack {
  exportId: string;
  label: string;
  source: AudioSource;
}

interface AudioStore {
  currentTrack: AudioTrack | null;
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  duration: number;
  position: number;

  playTrack: (track: AudioTrack) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  seek: (position: number) => void;

  setPlaybackStatus: (status: { isPlaying: boolean; position: number; duration: number }) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearTrack: () => void;
}

const initialState = {
  currentTrack: null as AudioTrack | null,
  isPlaying: false,
  isLoading: false,
  error: null as string | null,
  duration: 0,
  position: 0,
};

export const useAudioStore = create<AudioStore>((set, get) => ({
  ...initialState,

  playTrack: (track) =>
    set({
      currentTrack: track,
      isLoading: true,
      error: null,
      isPlaying: true,
      position: 0,
      duration: 0,
    }),

  pause: () => set({ isPlaying: false }),

  resume: () => set({ isPlaying: true }),

  stop: () => {
    get().clearTrack();
  },

  seek: (position) => set({ position }),

  setPlaybackStatus: (status) =>
    set({
      isPlaying: status.isPlaying,
      position: status.position,
      duration: status.duration,
    }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error, isLoading: false }),

  clearTrack: () => set({ ...initialState }),
}));
