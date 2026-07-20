import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx,js,jsx}',
    './src/**/*.{ts,tsx,js,jsx}',
    './components/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      /**
       * SPACING RHYTHM SYSTEM
       * Page sections:     space-y-8  (32px) — between major zones on a page
       * Card groups:       space-y-6  (24px) — between cards/panels within a section
       * In-card content:   space-y-4  (16px) — between elements within a card
       * Dense lists:       space-y-3  (12px) — between compact rows (library, inventory)
       * Inline elements:   space-y-2  (8px)  — between tightly coupled elements
       *
       * CARD PADDING TIERS (via <Card> component)
       * sm:  p-4  (16px) — default, list items, compact panels
       * md:  p-5  (20px) — standard content cards, entry cards
       * lg:  p-6  (24px) — hero cards, expanded states, empty states
       *
       * PAGE MAX-WIDTH TIERS
       * Reading surfaces (My Sky, Connection detail, Listen): max-w-4xl (896px)
       * Multi-column surfaces (Today, Sandbox workbench):     max-w-6xl (1152px)
       * Marketing/hero (Home, Community hero):                max-w-7xl (1280px)
       */
      colors: {
        bg: '#0C1320',
        surface: '#0F172A',
        panel: '#111827',
        bgElev: '#1a2332',
        text: '#E5E7EB',
        subtext: '#9CA3AF',
        border: 'rgba(255,255,255,0.10)',
        'surface-0': '#0F1419',
        'surface-1': '#151B24',
        'surface-2': '#1A222E',
        'surface-3': '#202938',
        'text-primary': '#F8FAFC',
        'text-secondary': '#CBD5E1',
        'text-muted': '#94A3B8',
        accent: {
          DEFAULT: '#0e9696',
          deep: '#00674f',
          hover: '#10b3b3',
          active: '#0c7a7a',
          muted: '#0e969620',
          glow: 'rgba(14, 150, 150, 0.35)',
        },
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        ring: '#0e9696',
        'rarity-common': '#6B7280',
        'rarity-uncommon': '#10B981',
        'rarity-rare': '#3B82F6',
        'rarity-legendary': '#8B5CF6',
        'hp-full': '#10B981',
        'hp-mid': '#F59E0B',
        'hp-low': '#EF4444',
        'hp-wounded': '#991B1B',
      },
      boxShadow: {
        glow: '0 0 0 2px rgba(0, 103, 79, 0.35), 0 0 30px rgba(0, 103, 79, 0.45)',
        soft: '0 4px 14px rgba(0, 0, 0, 0.25)',
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.15)',
        DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.2), 0 1px 2px -1px rgba(0, 0, 0, 0.2)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.25), 0 2px 4px -2px rgba(0, 0, 0, 0.25)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.3)',
      },
      fontFamily: {
        sans: ['var(--font-manrope)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-cormorant)', 'Georgia', 'serif'],
      },
      maxWidth: {
        content: '72rem',
      },
      transitionDuration: {
        fast: '120ms',
        base: '200ms',
        slow: '300ms',
      },
      transitionTimingFunction: {
        aurora: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      borderRadius: {
        '2xl': '1rem',
        pill: '9999px',
      },
      fontSize: {
        display: ['3rem', { lineHeight: '1.1', fontWeight: '700' }],
        'display-lg': ['3.75rem', { lineHeight: '1.1', fontWeight: '700' }],
        h1: ['2.25rem', { lineHeight: '1.2', fontWeight: '700' }],
        h2: ['1.875rem', { lineHeight: '1.3', fontWeight: '600' }],
        h3: ['1.5rem', { lineHeight: '1.4', fontWeight: '600' }],
        h4: ['1.125rem', { lineHeight: '1.4', fontWeight: '600' }],
        body: ['1rem', { lineHeight: '1.7' }],
        'body-sm': ['0.875rem', { lineHeight: '1.6' }],
        caption: ['0.75rem', { lineHeight: '1.5' }],
      },
    },
  },
  plugins: [],
};

export default config;
