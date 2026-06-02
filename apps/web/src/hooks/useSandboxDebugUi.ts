'use client';

import { useEffect, useState } from 'react';

/** True when Sandbox is loaded with ?debug=true (developer instrumentation). */
export function useSandboxDebugUi(): boolean {
  const [debug, setDebug] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setDebug(params.get('debug') === 'true');
  }, []);

  return debug;
}
