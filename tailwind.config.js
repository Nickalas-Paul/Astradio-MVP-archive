import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx,js,jsx}',
    './src/**/*.{ts,tsx,js,jsx}',
    './components/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0C1320',          // app background
        surface: '#0F172A',     // panel background
        text: '#E5E7EB',        // default text
        border: 'rgba(255,255,255,0.10)',
        emeraldMuted: 'rgba(16,185,129,0.25)', // used for hovers
      },
      boxShadow: {
        glow: '0 0 0 2px rgba(16,185,129,0.35), 0 0 30px rgba(16,185,129,0.45)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
};

export default config;