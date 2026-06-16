'use client';

import { useCallback, useEffect, useState } from 'react';

export const WHEEL_DISPLAY_MODE_STORAGE_KEY = 'astradio_wheel_display_mode';

export type WheelDisplayMode = 'technical' | 'simple';

function readStoredMode(): WheelDisplayMode {
  if (typeof window === 'undefined') return 'technical';
  const stored = localStorage.getItem(WHEEL_DISPLAY_MODE_STORAGE_KEY);
  return stored === 'simple' ? 'simple' : 'technical';
}

export function useWheelDisplayMode() {
  const [mode, setModeState] = useState<WheelDisplayMode>('technical');

  useEffect(() => {
    const sync = () => setModeState(readStoredMode());
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('astradio-wheel-display-mode', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('astradio-wheel-display-mode', sync);
    };
  }, []);

  const setMode = useCallback((next: WheelDisplayMode) => {
    setModeState(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(WHEEL_DISPLAY_MODE_STORAGE_KEY, next);
      window.dispatchEvent(new Event('astradio-wheel-display-mode'));
    }
  }, []);

  return { mode, setMode };
}
