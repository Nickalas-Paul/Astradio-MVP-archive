import type { ExpoConfig } from 'expo/config';

const config = {
  name: 'Astradio',
  slug: 'astradio',
  scheme: 'astradio',
  version: '1.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: '#111111',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#111111',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'io.astradio.app',
    buildNumber: '1',
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'Astradio uses your location to calculate accurate astrological charts based on where you were born.',
    },
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
      ],
    },
  },
  android: {
    package: 'io.astradio.app',
    versionCode: 5,
    adaptiveIcon: {
      backgroundColor: '#111111',
      foregroundImage: './assets/android-icon-foreground.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: ['expo-audio', 'expo-router', 'expo-font', 'expo-secure-store', 'expo-updates'],
  updates: {
    url: 'https://u.expo.dev/649114e2-8e54-4027-9b10-a63c9c4479e8',
  },
  runtimeVersion: {
    policy: 'appVersion' as const,
  },
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: '649114e2-8e54-4027-9b10-a63c9c4479e8',
    },
  },
};

export default config as ExpoConfig;
