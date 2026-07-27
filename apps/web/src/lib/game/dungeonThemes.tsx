import type { ReactNode } from 'react';

export type DungeonTemperature = 'hot' | 'warm' | 'cool' | 'cold' | 'neutral';

export type DungeonAccent = {
  primary: string;
  primaryAlpha: (a: number) => string;
  text: string;
  border: string;
  glow: string;
};

export type DungeonTheme = {
  house: number;
  name: string;
  domain: string;
  temperature: DungeonTemperature;
  bg: {
    gradient: string;
    radial: string;
    particleColor: string;
  };
  accent: DungeonAccent;
  sigil: ReactNode;
};

function accentFromRgb(r: number, g: number, b: number, extras?: Partial<DungeonAccent>): DungeonAccent {
  return {
    primary: `rgba(${r},${g},${b},1)`,
    primaryAlpha: (a) => `rgba(${r},${g},${b},${a})`,
    text: extras?.text ?? `rgba(${r},${Math.min(255, g + 20)},${Math.min(255, b + 20)},0.9)`,
    border: extras?.border ?? `rgba(${r},${g},${b},0.2)`,
    glow: extras?.glow ?? `rgba(${r},${g},${b},0.3)`,
  };
}

function SigilFlame() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden fill="currentColor">
      <path d="M8 1.5c1.2 2.2-.2 3.4-.2 5.2 0 1.1.6 1.8 1.4 1.8.9 0 1.5-.9 1.5-2.1 0-.7-.2-1.3-.5-1.9 1.8 1.2 2.8 2.8 2.8 4.8A5 5 0 0 1 8 14.5 5 5 0 0 1 3 7.3C3 4.8 5.2 3.2 8 1.5Z" />
    </svg>
  );
}

function SigilCoin() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 4.5v7M5.5 6.2c.6-.7 1.4-1 2.5-1s1.9.3 2.5 1M5.5 9.8c.6.7 1.4 1 2.5 1s1.9-.3 2.5-1" />
    </svg>
  );
}

function SigilWhisper() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M3 5.5c1.5-1.5 3-2.2 5-2.2s3.5.7 5 2.2M4.5 8c1-.9 2-1.4 3.5-1.4S10.5 7.1 11.5 8M6.2 10.5c.6-.5 1.2-.7 1.8-.7s1.2.2 1.8.7" />
    </svg>
  );
}

function SigilCrypt() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M3 13.5V7l5-4.5 5 4.5v6.5" />
      <path d="M6.5 13.5v-3.5h3v3.5" />
    </svg>
  );
}

function SigilStage() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden fill="currentColor">
      <path d="M8 2.2 9.4 6h3.8l-3 2.3 1.1 3.8L8 9.9l-3.3 2.2 1.1-3.8-3-2.3h3.8L8 2.2Z" />
    </svg>
  );
}

function SigilShield() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M8 2.5 13 4.5v3.8c0 3.2-2.1 5.2-5 6.2-2.9-1-5-3-5-6.2V4.5L8 2.5Z" />
    </svg>
  );
}

function SigilMirror() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4">
      <ellipse cx="8" cy="8" rx="4.5" ry="6" />
      <path d="M8 2v12" opacity="0.5" />
    </svg>
  );
}

function SigilGate() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M3 13.5V6.5L8 3l5 3.5v7" />
      <path d="M6.5 13.5V9h3v4.5" />
      <circle cx="8" cy="7" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SigilStar() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden fill="currentColor">
      <path d="M8 1.8 9.1 6H13.5l-3.5 2.6 1.3 4.2L8 10.6 4.7 12.8 6 8.6 2.5 6h4.4L8 1.8Z" />
    </svg>
  );
}

function SigilSummit() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M2.5 12.5 8 3.5l5.5 9H2.5Z" />
      <path d="M5.5 12.5 8 8l2.5 4.5" />
    </svg>
  );
}

function SigilNetwork() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="8" cy="4" r="1.5" />
      <circle cx="4" cy="11" r="1.5" />
      <circle cx="12" cy="11" r="1.5" />
      <path d="M8 5.5 4.8 9.5M8 5.5l3.2 4M5.5 11h5" />
    </svg>
  );
}

function SigilDream() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M3 9c1.5-3 4-4.5 5.5-4.5S11.5 6 13 9c-1.5 3-4 4.5-5.5 4.5S4.5 12 3 9Z" />
      <circle cx="8.5" cy="9" r="1.4" />
    </svg>
  );
}

/** Display domains for theming UI (presentation). Names match chapter_labels.json. */
export const DUNGEON_THEMES: Record<number, DungeonTheme> = {
  1: {
    house: 1,
    name: 'The Identity Forge',
    domain: 'Self',
    temperature: 'hot',
    bg: {
      gradient: 'linear-gradient(175deg, #0C1320 0%, #1e1510 25%, #2a1a12 45%, #1e1510 70%, #0C1320 100%)',
      radial: 'radial-gradient(ellipse 100% 90% at 50% 80%, rgba(200,100,40,0.06) 0%, transparent 60%)',
      particleColor: 'rgba(255,160,60,0.3)',
    },
    accent: accentFromRgb(220, 140, 60, {
      text: 'rgba(220,160,80,0.9)',
      glow: 'rgba(220,120,40,0.4)',
    }),
    sigil: <SigilFlame />,
  },
  2: {
    house: 2,
    name: 'The Vault of Worth',
    domain: 'Resources',
    temperature: 'warm',
    bg: {
      gradient: 'linear-gradient(175deg, #0C1320 0%, #1a1810 25%, #24201a 45%, #1a1810 70%, #0C1320 100%)',
      radial: 'radial-gradient(ellipse 90% 80% at 50% 60%, rgba(200,170,80,0.05) 0%, transparent 55%)',
      particleColor: 'rgba(200,170,80,0.25)',
    },
    accent: accentFromRgb(200, 170, 80, { text: 'rgba(210,185,100,0.9)' }),
    sigil: <SigilCoin />,
  },
  3: {
    house: 3,
    name: 'The Hall of Whispers',
    domain: 'Communication',
    temperature: 'cool',
    bg: {
      gradient: 'linear-gradient(172deg, #0C1320 0%, #141820 28%, #1a2030 50%, #141820 72%, #0C1320 100%)',
      radial: 'radial-gradient(ellipse 110% 70% at 40% 30%, rgba(180,190,210,0.06) 0%, transparent 55%)',
      particleColor: 'rgba(180,190,210,0.3)',
    },
    accent: accentFromRgb(180, 190, 210, {
      text: 'rgba(190,200,220,0.9)',
      border: 'rgba(180,190,210,0.18)',
    }),
    sigil: <SigilWhisper />,
  },
  4: {
    house: 4,
    name: 'The Ancestral Crypt',
    domain: 'Home',
    temperature: 'warm',
    bg: {
      gradient: 'linear-gradient(176deg, #0C1320 0%, #141a12 28%, #1e2418 48%, #141a12 72%, #0C1320 100%)',
      radial: 'radial-gradient(ellipse 80% 90% at 50% 70%, rgba(160,180,120,0.05) 0%, transparent 60%)',
      particleColor: 'rgba(200,170,100,0.25)',
    },
    accent: accentFromRgb(160, 180, 120, {
      text: 'rgba(180,200,140,0.9)',
      border: 'rgba(160,180,120,0.18)',
    }),
    sigil: <SigilCrypt />,
  },
  5: {
    house: 5,
    name: 'The Arena of Expression',
    domain: 'Creativity',
    temperature: 'hot',
    bg: {
      gradient: 'linear-gradient(174deg, #0C1320 0%, #1e1418 26%, #2a1a20 46%, #1e1418 70%, #0C1320 100%)',
      radial: 'radial-gradient(ellipse 70% 70% at 50% 40%, rgba(220,160,100,0.06) 0%, transparent 55%)',
      particleColor: 'rgba(220,160,100,0.3)',
    },
    accent: accentFromRgb(220, 160, 100, {
      text: 'rgba(230,175,115,0.9)',
      glow: 'rgba(220,160,100,0.4)',
    }),
    sigil: <SigilStage />,
  },
  6: {
    house: 6,
    name: 'The Proving Grounds',
    domain: 'Service',
    temperature: 'cool',
    bg: {
      gradient: 'linear-gradient(178deg, #0C1320 0%, #101820 25%, #14202a 45%, #101820 70%, #0C1320 100%)',
      radial: 'radial-gradient(ellipse 100% 60% at 50% 20%, rgba(140,170,200,0.05) 0%, transparent 50%)',
      particleColor: 'rgba(140,170,200,0.25)',
    },
    accent: accentFromRgb(140, 170, 200, {
      text: 'rgba(160,185,215,0.9)',
      border: 'rgba(140,170,200,0.18)',
    }),
    sigil: <SigilShield />,
  },
  7: {
    house: 7,
    name: 'The Relational Dungeon',
    domain: 'Partnership',
    temperature: 'neutral',
    bg: {
      gradient: 'linear-gradient(175deg, #0C1320 0%, #161620 26%, #1e1e2a 46%, #161620 70%, #0C1320 100%)',
      radial: 'radial-gradient(ellipse 90% 80% at 50% 50%, rgba(180,170,200,0.04) 0%, transparent 55%)',
      particleColor: 'rgba(180,170,200,0.25)',
    },
    accent: accentFromRgb(180, 170, 200, {
      text: 'rgba(195,185,215,0.9)',
      border: 'rgba(180,170,200,0.18)',
    }),
    sigil: <SigilMirror />,
  },
  8: {
    house: 8,
    name: 'The Underworld Gate',
    domain: 'Transformation',
    temperature: 'cold',
    bg: {
      gradient: 'linear-gradient(176deg, #0C1320 0%, #140e1e 26%, #1e1428 46%, #140e1e 70%, #0C1320 100%)',
      radial: 'radial-gradient(ellipse 80% 90% at 50% 80%, rgba(160,120,220,0.05) 0%, transparent 60%)',
      particleColor: 'rgba(160,120,220,0.3)',
    },
    accent: accentFromRgb(160, 120, 220, {
      text: 'rgba(180,145,235,0.9)',
      glow: 'rgba(160,120,220,0.35)',
    }),
    sigil: <SigilGate />,
  },
  9: {
    house: 9,
    name: "The Pilgrim's Ascent",
    domain: 'Philosophy',
    temperature: 'cool',
    bg: {
      gradient: 'linear-gradient(170deg, #0C1320 0%, #111d3a 30%, #1a2a52 55%, #16204a 75%, #0C1320 100%)',
      radial: 'radial-gradient(ellipse 120% 80% at 60% 20%, rgba(120,140,200,0.08) 0%, transparent 60%)',
      particleColor: 'rgba(180,200,255,0.4)',
    },
    accent: accentFromRgb(120, 160, 255, { text: 'rgba(160,180,240,0.9)' }),
    sigil: <SigilStar />,
  },
  10: {
    house: 10,
    name: 'The Summit Tribunal',
    domain: 'Legacy',
    temperature: 'cold',
    bg: {
      gradient: 'linear-gradient(178deg, #0C1320 0%, #0f1520 20%, #141a24 40%, #12161e 65%, #0C1320 100%)',
      radial: 'radial-gradient(ellipse 80% 60% at 50% 10%, rgba(180,170,140,0.03) 0%, transparent 50%)',
      particleColor: 'rgba(180,170,130,0.3)',
    },
    accent: accentFromRgb(180, 170, 130, { text: 'rgba(200,190,150,0.9)' }),
    sigil: <SigilSummit />,
  },
  11: {
    house: 11,
    name: 'The Network Labyrinth',
    domain: 'Community',
    temperature: 'cool',
    bg: {
      gradient: 'linear-gradient(173deg, #0C1320 0%, #0e1820 26%, #142028 46%, #0e1820 70%, #0C1320 100%)',
      radial: 'radial-gradient(ellipse 100% 80% at 55% 40%, rgba(80,200,200,0.06) 0%, transparent 55%)',
      particleColor: 'rgba(80,200,200,0.3)',
    },
    accent: accentFromRgb(80, 200, 200, { text: 'rgba(100,215,215,0.9)' }),
    sigil: <SigilNetwork />,
  },
  12: {
    house: 12,
    name: 'The Dream Vault',
    domain: 'Unconscious',
    temperature: 'cold',
    bg: {
      gradient: 'linear-gradient(176deg, #0C1320 0%, #0e1428 28%, #141e38 48%, #0e1428 72%, #0C1320 100%)',
      radial: 'radial-gradient(ellipse 110% 90% at 50% 60%, rgba(100,140,220,0.06) 0%, transparent 60%)',
      particleColor: 'rgba(100,140,220,0.3)',
    },
    accent: accentFromRgb(100, 140, 220, { text: 'rgba(130,165,235,0.9)' }),
    sigil: <SigilDream />,
  },
};

export function getDungeonTheme(house: number | null | undefined): DungeonTheme {
  const h = typeof house === 'number' && house >= 1 && house <= 12 ? house : 9;
  return DUNGEON_THEMES[h] ?? DUNGEON_THEMES[9]!;
}
