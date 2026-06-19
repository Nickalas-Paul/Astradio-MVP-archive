import { useAudioStore, type AudioTrack } from '../store/audio';

export function useAudioPlayback(track: AudioTrack) {
  const currentTrack = useAudioStore((s) => s.currentTrack);
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const isLoading = useAudioStore((s) => s.isLoading);
  const playTrack = useAudioStore((s) => s.playTrack);
  const pause = useAudioStore((s) => s.pause);
  const resume = useAudioStore((s) => s.resume);

  const isActive = currentTrack?.exportId === track.exportId;
  const isThisPlaying = isActive && isPlaying;
  const isThisLoading = isActive && isLoading;

  const handlePlay = () => {
    if (isActive) {
      if (isPlaying) {
        pause();
      } else {
        resume();
      }
    } else {
      playTrack(track);
    }
  };

  return { handlePlay, isThisPlaying, isThisLoading, isActive };
}
