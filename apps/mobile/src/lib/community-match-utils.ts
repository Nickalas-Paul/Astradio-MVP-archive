import type { RelationalIntent } from '../constants/community-constants';
import { MAX_OUTGOING_CONNECTION_REQUESTS } from '../constants/community-constants';
import type { CompatibilityExplanationProfile, MatchResult, PendingIntent, SynastryBulletLine } from '../types/community';

const DISCOVERY_BULLET_LABELS: Record<'forThem' | 'forYou' | 'together', string> = {
  forThem: "Why you're good for them",
  forYou: "Why they're good for you",
  together: "Why you're good together",
};

function parseBulletLine(raw: unknown): SynastryBulletLine | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const anchor = typeof o.anchor === 'string' ? o.anchor : '';
  const text = typeof o.text === 'string' ? o.text : '';
  if (!anchor && !text) return null;
  return { anchor, text };
}

export function parseExplanationProfile(raw: unknown, mode: RelationalIntent): CompatibilityExplanationProfile {
  const baseEp = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const sbRaw = baseEp.synastryBullets ?? baseEp.synastry_bullets;
  let synastryBullets: CompatibilityExplanationProfile['synastryBullets'];

  if (sbRaw && typeof sbRaw === 'object') {
    const o = sbRaw as Record<string, unknown>;
    const forYou = parseBulletLine(o.forYou) ?? parseBulletLine(o.for_you);
    const forThem = parseBulletLine(o.forThem) ?? parseBulletLine(o.for_them);
    const together = parseBulletLine(o.together);
    if (forYou && forThem && together) {
      synastryBullets = { forYou, forThem, together };
    }
  }

  return {
    intent: baseEp.intent === 'lover' ? 'lover' : baseEp.intent === 'friend' ? 'friend' : mode,
    intentFitSummary: String(baseEp.intentFitSummary ?? ''),
    primarySupports: Array.isArray(baseEp.primarySupports)
      ? baseEp.primarySupports.map(String)
      : [],
    secondarySupports: Array.isArray(baseEp.secondarySupports)
      ? baseEp.secondarySupports.map(String)
      : [],
    tensionsOrLimits: Array.isArray(baseEp.tensionsOrLimits)
      ? baseEp.tensionsOrLimits.map(String)
      : [],
    ...(synastryBullets ? { synastryBullets } : {}),
  };
}

export function normalizeMatchFromApi(raw: unknown, mode: RelationalIntent): MatchResult {
  const m = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const epRaw = m.explanationProfile ?? m.explanation_profile;
  return {
    userId: String(m.userId ?? ''),
    chartId: String(m.chartId ?? ''),
    displayName: String(m.displayName ?? m.userId ?? 'User'),
    ...(typeof m.handle === 'string' && m.handle.trim()
      ? { handle: m.handle.trim().replace(/^@/, '') }
      : {}),
    explanationProfile: parseExplanationProfile(epRaw, mode),
    lastUpdated: String(m.lastUpdated ?? new Date().toISOString()),
    ...(typeof m.compatibilityFieldHash === 'string'
      ? { compatibilityFieldHash: m.compatibilityFieldHash }
      : {}),
    ...(typeof m.bio === 'string' && m.bio.trim() ? { bio: m.bio } : {}),
    ...(typeof m.avatarUrl === 'string' && m.avatarUrl.trim() ? { avatarUrl: m.avatarUrl } : {}),
    ...(typeof m.lookingFor === 'string' && m.lookingFor.trim() ? { lookingFor: m.lookingFor } : {}),
    ...(Array.isArray(m.chartHighlights)
      ? {
          chartHighlights: (m.chartHighlights as unknown[])
            .filter((h): h is string => typeof h === 'string' && h.trim().length > 0)
            .map((h) => h.trim()),
        }
      : {}),
  };
}

export function discoveryBulletFromEp(
  ep: CompatibilityExplanationProfile,
  which: 'forYou' | 'forThem' | 'together'
): SynastryBulletLine {
  const label = DISCOVERY_BULLET_LABELS[which];
  const structured = ep.synastryBullets?.[which];
  if (structured?.text) {
    return {
      anchor: structured.anchor?.trim() || label,
      text: structured.text,
    };
  }
  const fallback =
    which === 'forYou'
      ? ep.primarySupports[0]
      : which === 'forThem'
        ? ep.secondarySupports[0]
        : ep.tensionsOrLimits[0];
  return { anchor: label, text: fallback || 'Compatibility insight unavailable' };
}

export function calculateDiscoveryRequestsRemaining(pendingOutgoingCount: number): number {
  return Math.max(0, MAX_OUTGOING_CONNECTION_REQUESTS - pendingOutgoingCount);
}

export function formatRefreshCountdown(now: Date = new Date()): string {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const diff = Math.max(0, tomorrow.getTime() - now.getTime());
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

export function isPendingOutgoing(
  userId: string,
  chartId: string,
  pendingOutgoing: PendingIntent[],
  relationshipKind: RelationalIntent
): boolean {
  return pendingOutgoing.some((intent) => {
    const rk = (intent.relationshipKind ?? 'friend') as RelationalIntent;
    return intent.toUserId === userId && intent.toChartId === chartId && rk === relationshipKind;
  });
}

export function isInventoryCoreEmpty(
  pairsCount: number,
  pendingIncomingCount: number,
  pendingOutgoingCount: number
): boolean {
  if (pendingIncomingCount > 0 || pendingOutgoingCount > 0) return false;
  return pairsCount === 0;
}
