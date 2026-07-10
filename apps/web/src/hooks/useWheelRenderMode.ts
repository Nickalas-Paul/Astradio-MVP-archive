'use client';

import { useCallback, useEffect, useState } from 'react';

export const WHEEL_RENDER_MODE_STORAGE_KEY = 'astradio_wheel_render_mode';

export type WheelRenderMode = 'static' | 'animated' | 'cinematic';

function readStoredMode(): WheelRenderMode {
  if (typeof window === 'undefined') return 'static';
  const stored = localStorage.getItem(WHEEL_RENDER_MODE_STORAGE_KEY);
  if (stored === 'animated' || stored === 'cinematic') return stored;
  return 'static';
}

export function useWheelRenderMode() {
  const [mode, setModeState] = useState<WheelRenderMode>('static');

  useEffect(() => {
    const sync = () => setModeState(readStoredMode());
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('astradio-wheel-render-mode', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('astradio-wheel-render-mode', sync);
    };
  }, []);

  const setMode = useCallback((next: WheelRenderMode) => {
    setModeState(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(WHEEL_RENDER_MODE_STORAGE_KEY, next);
      window.dispatchEvent(new Event('astradio-wheel-render-mode'));
    }
  }, []);

  return { mode, setMode };
}
