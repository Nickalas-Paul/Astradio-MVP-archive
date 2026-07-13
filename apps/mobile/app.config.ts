import type { ExpoConfig } from 'expo/config';

const config = {
  name: 'Astradio',
  slug: 'astradio',
  scheme: 'astradio',
  version: '1.0.0',
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
  },
  android: {
    package: 'io.astradio.app',
    versionCode: 2,
    adaptiveIcon: {
      backgroundColor: '#111111',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
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
