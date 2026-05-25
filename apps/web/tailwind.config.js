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
        bg: '#0C1320',
        surface: '#0F172A',
        panel: '#111827',
        bgElev: '#1a2332',
        text: '#E5E7EB',
        subtext: '#9CA3AF',
        border: 'rgba(255,255,255,0.10)',
        emeraldMuted: 'rgba(16,185,129,0.25)',
        'surface-0': '#0F1419',
        'surface-1': '#151B24',
        'surface-2': '#1A222E',
        'surface-3': '#202938',
        'text-primary': '#F8FAFC',
        'text-secondary': '#CBD5E1',
        'text-muted': '#94A3B8',
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        ring: '#10B981',
      },
      boxShadow: {
        glow: '0 0 0 2px rgba(16,185,129,0.35), 0 0 30px rgba(16,185,129,0.45)',
        soft: '0 4px 14px rgba(0, 0, 0, 0.25)',
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.15)',
        DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.2), 0 1px 2px -1px rgba(0, 0, 0, 0.2)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.25), 0 2px 4px -2px rgba(0, 0, 0, 0.25)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.3)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['var(--font-lora)', 'Lora', 'Georgia', 'serif'],
      },
      maxWidth: {
        content: '72rem',
      },
      transitionDuration: {
        fast: '120ms',
        base: '160ms',
        slow: '200ms',
      },
      transitionTimingFunction: {
        aurora: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      borderRadius: {
        '2xl': '1rem',
        pill: '9999px',
      },
    },
  },
  plugins: [],
};

export default config;
