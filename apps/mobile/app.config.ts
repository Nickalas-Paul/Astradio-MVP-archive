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
  plugins: ['expo-router', 'expo-font', 'expo-secure-store'],
  experiments: {
    typedRoutes: true,
  },
};

export default config as ExpoConfig;
