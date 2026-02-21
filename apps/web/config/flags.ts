// Consolidated Feature Flag System - Single source of truth
// Fail-closed behavior for new features
//
// REGRESSION: FLAGS must be read lazily (getFlags()) to avoid TDZ in client bundle
// when Community (and other) routes load. Do not revert to eager init.

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
}

const DEFAULT_FLAGS: FeatureFlags = {
  USE_MOCK: false,
  ENABLE_TRENDING: false,
  ENABLE_COMPAT: false,
  ENABLE_SOCIAL: true,
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

let _flags: FeatureFlags | null = null;
function getFlags(): FeatureFlags {
  if (_flags === null) {
    _flags = Object.freeze({ ...DEFAULT_FLAGS, ...getRuntimeFlags() }) as FeatureFlags;
  }
  return _flags;
}

// FLAGS is not exported to avoid any load-time property access (Proxy/getOwnPropertyDescriptor
// can run during bundler or module init and trigger getFlags() before module is ready).
// Use isFeatureEnabled(flag) or getFeatureFlags() instead.
export const isFeatureEnabled = (flag: keyof FeatureFlags): boolean => getFlags()[flag];

export const isFeatureEnabledLegacy = (flag: string): boolean => {
  if (flag === 'ENABLE_NOTIFICATIONS') return getFlags().ENABLE_SOCIAL;
  return isFeatureEnabled(flag as keyof FeatureFlags);
};

export const featureGate = <T,>(flag: keyof FeatureFlags, whenEnabled: T, whenDisabled: T | null = null): T | null => {
  return isFeatureEnabled(flag) ? whenEnabled : whenDisabled;
};

export const enableFeature = (flag: keyof FeatureFlags) => {
  if (typeof window !== 'undefined') {
    (window as any).__FLAGS__ = (window as any).__FLAGS__ || {};
    (window as any).__FLAGS__[flag] = true;
  }
};

export const disableFeature = (flag: keyof FeatureFlags) => {
  if (typeof window !== 'undefined') {
    (window as any).__FLAGS__ = (window as any).__FLAGS__ || {};
    (window as any).__FLAGS__[flag] = false;
  }
};

export const getFeatureFlags = (): FeatureFlags => ({ ...getFlags() });

export const getFeatureFlagStatusString = (): string | null => {
  if (process.env.NODE_ENV !== 'development') return null;
  return Object.entries(getFlags())
    .map(([k, v]) => `${k}: ${v ? 'ON' : 'OFF'}`)
    .join(', ');
};
