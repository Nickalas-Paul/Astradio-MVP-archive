// Feature Flag System - Fail-closed behavior for new features
// UI gates new features behind flags; if disabled, show empty states—not errors

export interface FeatureFlags {
  USE_MOCK: boolean;
  ENABLE_TRENDING: boolean;
  ENABLE_COMPAT: boolean;
  ENABLE_SOCIAL: boolean;
  ENABLE_ATLAS: boolean;
  ENABLE_ANALYTICS: boolean;
  ENABLE_SHARING: boolean;
  ENABLE_PLAYLISTS: boolean;
  ENABLE_NOTIFICATIONS: boolean;
}

// Default flags (fail-closed)
const DEFAULT_FLAGS: FeatureFlags = {
  USE_MOCK: false,
  ENABLE_TRENDING: false,
  ENABLE_COMPAT: false,
  ENABLE_SOCIAL: true,  // Enable social features by default
  ENABLE_ATLAS: true,   // Enable education hub by default
  ENABLE_ANALYTICS: true, // Telemetry is generally enabled by default
  ENABLE_SHARING: false,
  ENABLE_PLAYLISTS: true, // Enable playlists as part of social features
  ENABLE_NOTIFICATIONS: false,
};

// Runtime flag detection - frozen per session to prevent mid-render toggles
const getRuntimeFlags = (): Partial<FeatureFlags> => {
  const flags: Partial<FeatureFlags> = {};

  // Check for mock mode (development)
  if (typeof window !== 'undefined') {
    flags.USE_MOCK = !!(window as any).__USE_MOCK__;
    
    // Check for feature flags in URL params (for testing)
    const urlParams = new URLSearchParams(window.location.search);
    flags.ENABLE_TRENDING = urlParams.get('trending') === '1' || urlParams.get('trending') === 'true';
    flags.ENABLE_COMPAT = urlParams.get('compat') === '1' || urlParams.get('compat') === 'true';
            flags.ENABLE_SOCIAL = urlParams.get('social') === '1' || urlParams.get('social') === 'true';
            flags.ENABLE_ATLAS = urlParams.get('atlas') === '1' || urlParams.get('atlas') === 'true';
            flags.ENABLE_ANALYTICS = urlParams.get('analytics') === '1' || urlParams.get('analytics') === 'true';
    flags.ENABLE_SHARING = urlParams.get('sharing') === '1' || urlParams.get('sharing') === 'true';
    flags.ENABLE_PLAYLISTS = urlParams.get('playlists') === '1' || urlParams.get('playlists') === 'true';
    flags.ENABLE_NOTIFICATIONS = urlParams.get('notifications') === '1' || urlParams.get('notifications') === 'true';
  }

  return flags;
};

// Merge runtime flags with defaults and freeze to prevent mutations
export const FLAGS: FeatureFlags = Object.freeze({
  ...DEFAULT_FLAGS,
  ...getRuntimeFlags(),
});

// Feature flag utilities
export const isFeatureEnabled = (flag: keyof FeatureFlags): boolean => {
  return FLAGS[flag];
};

export const withFeatureFlag = <T>(
  flag: keyof FeatureFlags,
  enabledComponent: T,
  disabledComponent?: T
): T | null => {
  if (isFeatureEnabled(flag)) {
    return enabledComponent;
  }
  return disabledComponent || null;
};

// Conditional rendering helper
// Avoid JSX in this module to keep it .ts and usable universally
export const featureGate = <T,>(flag: keyof FeatureFlags, whenEnabled: T, whenDisabled: T | null = null): T | null => {
  return isFeatureEnabled(flag) ? whenEnabled : whenDisabled;
};

// Development helpers
export const enableFeature = (flag: keyof FeatureFlags) => {
  if (typeof window !== 'undefined') {
    (window as any).__FLAGS__ = (window as any).__FLAGS__ || {};
    (window as any).__FLAGS__[flag] = true;
    console.log(`[Feature Flag] Enabled: ${flag}`);
  }
};

export const disableFeature = (flag: keyof FeatureFlags) => {
  if (typeof window !== 'undefined') {
    (window as any).__FLAGS__ = (window as any).__FLAGS__ || {};
    (window as any).__FLAGS__[flag] = false;
    console.log(`[Feature Flag] Disabled: ${flag}`);
  }
};

// Debug information
export const getFeatureFlags = (): FeatureFlags => {
  return { ...FLAGS };
};

// Log current flags in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('[Feature Flags] Current configuration:', FLAGS);
}

// URL parameter helpers for testing
export const addFeatureFlagToUrl = (flag: keyof FeatureFlags, enabled: boolean = true) => {
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    url.searchParams.set(flag.toLowerCase(), enabled.toString());
    window.history.replaceState({}, '', url.toString());
  }
};

export const removeFeatureFlagFromUrl = (flag: keyof FeatureFlags) => {
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    url.searchParams.delete(flag.toLowerCase());
    window.history.replaceState({}, '', url.toString());
  }
};

// Feature flag status component for development
// Dev helper: return a plain string summary instead of JSX, to avoid TSX in this file
export const getFeatureFlagStatusString = (): string | null => {
  if (process.env.NODE_ENV !== 'development') return null;
  return Object.entries(FLAGS)
    .map(([k, v]) => `${k}: ${v ? 'ON' : 'OFF'}`)
    .join(', ');
};
