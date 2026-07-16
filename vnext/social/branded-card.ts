console.log('branded-card loaded');

import sharp from 'sharp';
import { BRAND, resolveRenderAsset } from '../render/design-tokens';
import { svgToPng } from '../render/standard/svg-to-png';

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1920;

export function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 8);
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Resolve a render-asset relative font path to a file:// URL for SVG @font-face. */
export function fontFileUrl(relativePath: string): string {
  const abs = resolveRenderAsset(relativePath).replace(/\\/g, '/');
  return `file://${abs}`;
}

export type BuildBrandedCardOptions = {
  title: string;
  date: string;
  bodyText: string;
  ctaText?: string;
};

/**
 * Pure branded 1080x1920 PNG builder. No network, DB, compose, or export-store calls.
 */
export async function buildBrandedCardPng(options: BuildBrandedCardOptions): Promise<Buffer> {
  const title = options.title;
  const displayDate = options.date;
  const bodyText = options.bodyText;
  const ctaText = options.ctaText?.trim() || 'astradio.io';

  const bg = BRAND.colors.background;
  const accent = BRAND.colors.accent;
  const bodyLines = wrapText(bodyText, 40);

  const logoPath = resolveRenderAsset(BRAND.logoPaths.wordmark);
  const logoTargetWidth = 420;
  const logoBuffer = await sharp(logoPath).resize(logoTargetWidth).png().toBuffer();

  const titleY = 220;
  const dateY = 300;
  const bodyStartY = 420;
  const bodyLineHeight = 52;
  const ctaY = CARD_HEIGHT - 120;

  const bodyTspans = bodyLines
    .map((line, i) => {
      const y = bodyStartY + i * bodyLineHeight;
      return `<tspan x="540" y="${y}">${escapeXml(line)}</tspan>`;
    })
    .join('');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}">
  <defs>
    <style>
      @font-face {
        font-family: 'ManropeBold';
        src: url('${fontFileUrl(BRAND.fontPaths.manropeBold)}');
      }
      @font-face {
        font-family: 'ManropeRegular';
        src: url('${fontFileUrl(BRAND.fontPaths.manropeRegular)}');
      }
      @font-face {
        font-family: 'ManropeMedium';
        src: url('${fontFileUrl(BRAND.fontPaths.manropeMedium)}');
      }
      @font-face {
        font-family: 'CormorantRegular';
        src: url('${fontFileUrl(BRAND.fontPaths.cormorantRegular)}');
      }
    </style>
  </defs>
  <rect width="100%" height="100%" fill="${bg}"/>
  <text x="540" y="${titleY}" text-anchor="middle" fill="${BRAND.colors.textPrimary}"
    font-family="ManropeBold" font-size="64">${escapeXml(title)}</text>
  <text x="540" y="${dateY}" text-anchor="middle" fill="${accent}"
    font-family="ManropeRegular" font-size="36">${escapeXml(displayDate)}</text>
  <text text-anchor="middle" fill="${BRAND.colors.textPrimary}"
    font-family="CormorantRegular" font-size="40">${bodyTspans}</text>
  <text x="540" y="${ctaY}" text-anchor="middle" fill="${accent}"
    font-family="ManropeMedium" font-size="34">${escapeXml(ctaText)}</text>
</svg>`;

  const textOverlay = await svgToPng(svg, CARD_WIDTH, CARD_HEIGHT);
  const logoTop = 72;

  return sharp({
    create: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      channels: 4,
      background: bg,
    },
  })
    .composite([
      { input: textOverlay, top: 0, left: 0 },
      { input: logoBuffer, top: logoTop, left: Math.round((CARD_WIDTH - logoTargetWidth) / 2) },
    ])
    .png()
    .toBuffer();
}
