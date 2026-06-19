import { NativeModules, TurboModuleRegistry } from 'react-native';

type ExpoAvModule = typeof import('expo-av');

let cachedModule: ExpoAvModule | null | undefined;
let cachedAvailability: boolean | undefined;

const NATIVE_MODULE_NAME = 'ExponentAV';

/**
 * expo-av calls requireNativeModule('ExponentAV') at import time (ExponentAV.js).
 * Probe native registration first so Expo Go never executes that require path.
 */
function isExponentAvNativeAvailable(): boolean {
  if (cachedAvailability !== undefined) {
    return cachedAvailability;
  }

  const nativeModules = NativeModules as Record<string, unknown>;
  if (nativeModules[NATIVE_MODULE_NAME] != null) {
    cachedAvailability = true;
    return true;
  }

  try {
    const turboModule = TurboModuleRegistry.get(NATIVE_MODULE_NAME);
    if (turboModule != null) {
      cachedAvailability = true;
      return true;
    }
  } catch {
    // TurboModuleRegistry unavailable or module not registered.
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const core = require('expo-modules-core') as {
      requireOptionalNativeModule?: (name: string) => unknown;
      NativeModulesProxy?: Record<string, unknown>;
    };

    if (typeof core.requireOptionalNativeModule === 'function') {
      const optional = core.requireOptionalNativeModule(NATIVE_MODULE_NAME);
      cachedAvailability = optional != null;
      return cachedAvailability;
    }

    if (core.NativeModulesProxy?.[NATIVE_MODULE_NAME] != null) {
      cachedAvailability = true;
      return true;
    }
  } catch {
    // expo-modules-core probe failed — treat as unavailable.
  }

  cachedAvailability = false;
  return false;
}

/**
 * Lazily load expo-av. Returns null when the native module is unavailable (e.g. Expo Go SDK 56).
 * Cached after first check so we only pay the require cost once.
 */
export function getExpoAv(): ExpoAvModule | null {
  if (cachedModule !== undefined) {
    return cachedModule;
  }

  if (!isExponentAvNativeAvailable()) {
    cachedModule = null;
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-av') as ExpoAvModule;
    if (!mod?.Audio?.Sound) {
      cachedModule = null;
      return null;
    }
    cachedModule = mod;
    return mod;
  } catch {
    cachedModule = null;
    cachedAvailability = false;
    return null;
  }
}

export function isExpoAvAvailable(): boolean {
  return getExpoAv() !== null;
}
