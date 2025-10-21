// Consolidated Feature Flag System - Single source of truth
// Fail-closed behavior for new features

export interface FeatureFlags {
  USE_MOCK: boolean;
  ENABLE_TRENDING: boolean;
  ENABLE_COMPAT: boolean;
  ENABLE_SOCIAL: boolean;
  ENABLE_ATLAS: boolean;
  ENABLE_ANALYTICS: boolean;
  ENABLE_SHARING: boolean;
  ENABLE_PLAYLISTS: boolean;
  ENABLE_VIZ_ENGINE: boolean;
  // ENABLE_NOTIFICATIONS removed - folded into ENABLE_SOCIAL
}

const DEFAULT_FLAGS: FeatureFlags = {
  USE_MOCK: false,
  ENABLE_TRENDING: false,
  ENABLE_COMPAT: false,
  ENABLE_SOCIAL: true, // Includes notifications
  ENABLE_ATLAS: true,
  ENABLE_ANALYTICS: true,
  ENABLE_SHARING: false,
  ENABLE_PLAYLISTS: true,
  ENABLE_VIZ_ENGINE: process.env.NODE_ENV === 'development',
};

const getRuntimeFlags = (): Partial<FeatureFlags> => {
  const flags: Partial<FeatureFlags> = {};
  if (typeof window !== 'undefined') {
    flags.USE_MOCK = !!(window as any).__USE_MOCK__;
    const urlParams = new URLSearchParams(window.location.search);
    flags.ENABLE_TRENDING = urlParams.get('trending') === '1' || urlParams.get('trending') === 'true';
    flags.ENABLE_COMPAT = urlParams.get('compat') === '1' || urlParams.get('compat') === 'true';
    flags.ENABLE_SOCIAL = urlParams.get('social') === '1' || urlParams.get('social') === 'true';
    flags.ENABLE_ATLAS = urlParams.get('atlas') === '1' || urlParams.get('atlas') === 'true';
    flags.ENABLE_ANALYTICS = urlParams.get('analytics') === '1' || urlParams.get('analytics') === 'true';
    flags.ENABLE_SHARING = urlParams.get('sharing') === '1' || urlParams.get('sharing') === 'true';
    flags.ENABLE_PLAYLISTS = urlParams.get('playlists') === '1' || urlParams.get('playlists') === 'true';
    flags.ENABLE_VIZ_ENGINE = urlParams.get('viz') === '1' || urlParams.get('viz') === 'true';
  }
  return flags;
};

export const FLAGS: FeatureFlags = Object.freeze({
  ...DEFAULT_FLAGS,
  ...getRuntimeFlags(),
});

export const isFeatureEnabled = (flag: keyof FeatureFlags): boolean => FLAGS[flag];

// Legacy compatibility - map old flag names
export const isFeatureEnabledLegacy = (flag: string): boolean => {
  if (flag === 'ENABLE_NOTIFICATIONS') {
    console.warn('[Feature Flag] ENABLE_NOTIFICATIONS is deprecated, use ENABLE_SOCIAL instead');
    return FLAGS.ENABLE_SOCIAL;
  }
  return isFeatureEnabled(flag as keyof FeatureFlags);
};

export const featureGate = <T,>(flag: keyof FeatureFlags, whenEnabled: T, whenDisabled: T | null = null): T | null => {
  return isFeatureEnabled(flag) ? whenEnabled : whenDisabled;
};

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

export const getFeatureFlags = (): FeatureFlags => ({ ...FLAGS });

export const getFeatureFlagStatusString = (): string | null => {
  if (process.env.NODE_ENV !== 'development') return null;
  return Object.entries(FLAGS)
    .map(([k, v]) => `${k}: ${v ? 'ON' : 'OFF'}`)
    .join(', ');
};
