import path from 'path';

export const BRAND = {
  colors: {
    accent: '#0e9696',
    accentDeep: '#00674f',
    background: '#0C1320',
    surface: '#0F172A',
    textPrimary: '#F1F5F9',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
  },
  fonts: {
    sans: 'Manrope',
    serif: 'Cormorant',
  },
  // Paths resolved relative to dist/vnext/vnext/ (see resolveRenderAsset)
  fontPaths: {
    manropeRegular: 'assets/fonts/Manrope-Regular.ttf',
    manropeBold: 'assets/fonts/Manrope-Bold.ttf',
    manropeSemiBold: 'assets/fonts/Manrope-SemiBold.ttf',
    manropeMedium: 'assets/fonts/Manrope-Medium.ttf',
    cormorantRegular: 'assets/fonts/Cormorant-Regular.ttf',
    cormorantBold: 'assets/fonts/Cormorant-Bold.ttf',
    cormorantItalic: 'assets/fonts/Cormorant-Italic.ttf',
    cormorantSemiBold: 'assets/fonts/Cormorant-SemiBold.ttf',
    cormorantMedium: 'assets/fonts/Cormorant-Medium.ttf',
  },
  logoPaths: {
    wordmark: 'assets/logo-wordmark.png',
  },
  weather: {
    bringing: '#0e9696',
    theyBringing: '#E8C56D',
    testing: '#D4836D',
  },
  sandbox: {
    single: '#0e9696',
    pair: '#E8C56D',
    whatIf: '#D4836D',
    group: '#8FAFD4',
  },
} as const;

/** Resolve a render asset path from compiled vnext/render/*.js to dist/vnext/vnext/<relative>. */
export function resolveRenderAsset(relativePath: string): string {
  return path.join(__dirname, '..', relativePath);
}
