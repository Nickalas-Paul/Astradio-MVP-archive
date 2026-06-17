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
  ENABLE_COMMUNITY_POSTS: boolean;
  ENABLE_ATLAS: boolean;
  ENABLE_ANALYTICS: boolean;
  ENABLE_SHARING: boolean;
  ENABLE_PLAYLISTS: boolean;
  ENABLE_VIZ_ENGINE: boolean;
}

// ENABLE_COMPAT: true for closed beta so Matches tab shows real compatibility behavior.
const DEFAULT_FLAGS: FeatureFlags = {
  USE_MOCK: false,
  ENABLE_TRENDING: false,
  ENABLE_COMPAT: true,
  ENABLE_SOCIAL: true,
  ENABLE_COMMUNITY_POSTS: process.env.NEXT_PUBLIC_ENABLE_COMMUNITY_POSTS === 'true',
  ENABLE_ATLAS: true,
  ENABLE_ANALYTICS: true,
  ENABLE_SHARING: false,
  ENABLE_PLAYLISTS: true,
  ENABLE_VIZ_ENGINE: process.env.NODE_ENV === 'development',
};

/** Only keys present in the URL override defaults; absence means leave default. */
function queryFlagEnabled(urlParams: URLSearchParams, key: string): boolean {
  return urlParams.get(key) === '1' || urlParams.get(key) === 'true';
}

const getRuntimeFlags = (): Partial<FeatureFlags> => {
  const flags: Partial<FeatureFlags> = {};
  if (typeof window !== 'undefined') {
    flags.USE_MOCK = !!(window as any).__USE_MOCK__;
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('trending')) flags.ENABLE_TRENDING = queryFlagEnabled(urlParams, 'trending');
    if (urlParams.has('compat')) flags.ENABLE_COMPAT = queryFlagEnabled(urlParams, 'compat');
    if (urlParams.has('social')) flags.ENABLE_SOCIAL = queryFlagEnabled(urlParams, 'social');
    if (urlParams.has('communityPosts')) flags.ENABLE_COMMUNITY_POSTS = queryFlagEnabled(urlParams, 'communityPosts');
    if (urlParams.has('atlas')) flags.ENABLE_ATLAS = queryFlagEnabled(urlParams, 'atlas');
    if (urlParams.has('analytics')) flags.ENABLE_ANALYTICS = queryFlagEnabled(urlParams, 'analytics');
    if (urlParams.has('sharing')) flags.ENABLE_SHARING = queryFlagEnabled(urlParams, 'sharing');
    if (urlParams.has('playlists')) flags.ENABLE_PLAYLISTS = queryFlagEnabled(urlParams, 'playlists');
    if (urlParams.has('viz')) flags.ENABLE_VIZ_ENGINE = queryFlagEnabled(urlParams, 'viz');
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
