// Atlas Route Guard - Ensures hard off when flag disabled
// Prevents any engine coupling and provides clean fallbacks

export const atlasEnabled = (): boolean => {
  if (typeof window === 'undefined') {
    // Server-side: default to enabled for SSR
    return true;
  }
  
  // Client-side: check feature flags
  const flags = (window as any).__FLAGS__;
  if (flags && typeof flags.ENABLE_ATLAS === 'boolean') {
    return flags.ENABLE_ATLAS;
  }
  
  // Fallback: check URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const atlasParam = urlParams.get('atlas');
  if (atlasParam === '0' || atlasParam === 'false') {
    return false;
  }
  if (atlasParam === '1' || atlasParam === 'true') {
    return true;
  }
  
  // Default: enabled (fail-open for better UX)
  return true;
};

export const atlasDisabled = (): boolean => !atlasEnabled();
