'use client';

import { WHEEL_COLORS } from '@/components/wheel/wheel-constants';
import { getSignGlyphSvg } from '@/components/wheel/wheel-glyphs';
import { signNameToIndex, type PeerBigThreeSigns } from '@/lib/sign-glyph-utils';

function InlineSignGlyph({ signName, size = 15 }: { signName: string; size?: number }) {
  const signIndex = signNameToIndex(signName);
  const glyph = signIndex != null ? getSignGlyphSvg(signIndex) : null;
  if (!glyph) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox={glyph.viewBox}
      className="inline-block shrink-0"
      aria-hidden
    >
      <path d={glyph.pathData} fill={WHEEL_COLORS.zodiacGlyphFill} />
    </svg>
  );
}

export function PeerBigThreeGlyphs({ bigThree }: { bigThree?: PeerBigThreeSigns | null }) {
  const signs = [bigThree?.sun, bigThree?.moon, bigThree?.rising].filter(
    (sign): sign is string => typeof sign === 'string' && sign.trim().length > 0
  );
  if (signs.length === 0) return null;

  return (
    <span className="inline-flex items-center gap-1 ml-1.5 align-middle" aria-hidden>
      {signs.map((sign) => (
        <InlineSignGlyph key={sign} signName={sign} size={15} />
      ))}
    </span>
  );
}
