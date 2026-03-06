/**
 * Lyria-only audio playback. Single path for all surfaces.
 * No Tone.js, no samples, no legacy engine. Fail-closed if artifact missing or invalid.
 */

export type PayloadAudio = {
  url?: string | null;
  base64?: string | null;
  provider?: string | null;
};

const LYRIA_PROVIDER = 'lyria';
const FORBIDDEN_PATH = '/audio/samples/';

function isAllowedUrl(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed.includes(FORBIDDEN_PATH)) return false;
  if (trimmed.startsWith('https:')) return true;
  if (trimmed.startsWith('blob:')) return true;
  if (trimmed.startsWith('http:') && typeof window !== 'undefined') {
    const base = window.location.origin;
    try {
      const u = new URL(trimmed, base);
      return u.origin === base;
    } catch {
      return false;
    }
  }
  if (trimmed.startsWith('/') && !trimmed.startsWith(FORBIDDEN_PATH)) return true;
  return false;
}

/**
 * Resolve payload.audio to a single playable URL. Validates Lyria-only (no /audio/samples).
 * @throws if payload has no url/base64 or url is forbidden
 */
export function getPlayableLyriaUrl(payload: PayloadAudio): string {
  if (payload.provider != null && payload.provider !== '' && payload.provider !== LYRIA_PROVIDER) {
    throw new Error(`[Astradio] Audio provider must be lyria. Got: ${payload.provider}`);
  }
  const url = payload.url?.trim();
  const base64 = typeof payload.base64 === 'string' ? payload.base64.trim() : null;
  if (url && url.length > 0) {
    if (!isAllowedUrl(url)) {
      throw new Error(`[Astradio] Forbidden audio URL (Lyria-only; no sample paths): ${url.slice(0, 80)}`);
    }
    return url;
  }
  if (base64 && base64.length > 0) {
    try {
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'audio/wav' });
      return URL.createObjectURL(blob);
    } catch (e) {
      throw new Error('[Astradio] Invalid base64 audio in payload.');
    }
  }
  throw new Error('[Astradio] No Lyria audio artifact (url or base64 required).');
}

let currentLyriaAudio: HTMLAudioElement | null = null;

/**
 * Stop any currently playing Lyria playback (e.g. Home Stop button).
 */
export function stopLyriaPlayback(): void {
  if (currentLyriaAudio) {
    currentLyriaAudio.pause();
    currentLyriaAudio.currentTime = 0;
    currentLyriaAudio = null;
  }
}

/**
 * Play Lyria audio from payload. Uses HTMLAudioElement only. No Tone.js, no samples.
 * Fail-closed: throws or rejects if artifact missing or invalid.
 */
export function playLyriaAudio(payload: PayloadAudio): Promise<void> {
  const playableUrl = getPlayableLyriaUrl(payload);
  return new Promise((resolve, reject) => {
    stopLyriaPlayback();
    const el = new Audio(playableUrl);
    currentLyriaAudio = el;
    el.play()
      .then(() => resolve())
      .catch((e) => {
        currentLyriaAudio = null;
        reject(e);
      });
    el.addEventListener('ended', () => {
      if (currentLyriaAudio === el) currentLyriaAudio = null;
    });
  });
}
