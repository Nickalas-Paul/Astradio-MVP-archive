const SIGNAL_TEMPLATE_LABELS: Record<string, string> = {
  resonates: 'Resonates',
  feeling_this: 'Feeling this',
  lets_pay_attention: "Let's pay attention",
  challenge_accepted: 'Challenge accepted',
};

const SIGNAL_TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  resonates: 'I recognize this energy between us',
  feeling_this: 'This transit is active for me right now',
  lets_pay_attention: 'They want you both to notice this one',
  challenge_accepted: 'For tense aspects testing the connection',
};

export function formatSignalTemplateLabel(templateId: string): string {
  const key = templateId.trim();
  if (SIGNAL_TEMPLATE_LABELS[key]) return SIGNAL_TEMPLATE_LABELS[key]!;
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatSignalTemplateDescription(templateId: string): string {
  const key = templateId.trim();
  return SIGNAL_TEMPLATE_DESCRIPTIONS[key] || '';
}

export function formatSignalTemplateWithDescription(templateId: string): {
  label: string;
  description: string;
} {
  return {
    label: formatSignalTemplateLabel(templateId),
    description: formatSignalTemplateDescription(templateId),
  };
}

export function formatSignalSentRelativeTime(iso: string): string {
  return formatSignalRelativeTime(iso, 'Sent');
}

export function formatSignalReceivedRelativeTime(iso: string): string {
  return formatSignalRelativeTime(iso, 'Received');
}

/** Neutral relative time for activity one-liners (no Sent/Received prefix). */
export function formatSignalActivityRelativeTime(iso: string): string {
  const raw = formatSignalRelativeTime(iso, 'Sent');
  if (raw === 'Sent recently') return 'recently';
  if (raw.startsWith('Sent ')) return raw.slice(5);
  return raw;
}

function formatSignalRelativeTime(iso: string, prefix: 'Sent' | 'Received'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return `${prefix} recently`;

  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return `${prefix} just now`;
  if (diffMin < 60) return `${prefix} ${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${prefix} ${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sentDay = new Date(d);
  sentDay.setHours(0, 0, 0, 0);
  if (sentDay.getTime() === today.getTime()) return `${prefix} today`;

  return `${prefix} ${d.toLocaleDateString()}`;
}

export type OutgoingSignalStatusLabel = 'Awaiting response' | 'Acknowledged' | 'Expired';

export function outgoingSignalStatusLabel(
  status: string,
  replyCount: number
): OutgoingSignalStatusLabel {
  if (replyCount > 0) return 'Acknowledged';
  if (status === 'expired' || status === 'closed') return 'Expired';
  return 'Awaiting response';
}

export function formatSignalAnchorContext(anchorType: string, anchorId: string): string {
  const id = anchorId.trim();
  if (anchorType === 'feed_item') {
    if (id.startsWith('pair:')) return `Transits · ${id.slice(5, 21)}${id.length > 21 ? '…' : ''}`;
    return `Transits · ${id.slice(0, 20)}${id.length > 20 ? '…' : ''}`;
  }
  return `${anchorType} · ${id.slice(0, 24)}${id.length > 24 ? '…' : ''}`;
}

/** Recipient-facing transit anchor line (pair feed signals). */
export function formatIncomingSignalTransitContext(
  senderDisplayName: string | null | undefined,
  anchorType: string,
  anchorId: string
): string {
  const name =
    typeof senderDisplayName === 'string' && senderDisplayName.trim()
      ? senderDisplayName.trim()
      : 'them';
  if (anchorType === 'feed_item') {
    return `About your connection with ${name}`;
  }
  return `About your connection with ${name}`;
}

/** UTC day start — matches server dedupe window for feed signal status. */
export function isSignalCreatedTodayUtc(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  return d >= todayStart;
}

export type SignalHistoryStatusLabel = 'Acknowledged' | 'Expired' | 'Open';

export function signalHistoryStatusLabel(status: string, replyCount: number): SignalHistoryStatusLabel {
  if (replyCount > 0) return 'Acknowledged';
  if (status === 'expired' || status === 'closed') return 'Expired';
  return 'Open';
}

export function formatSignalHistoryDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unknown date';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatSignalHistoryTimeSpan(oldestAt: string | null, newestAt: string | null): string {
  if (!oldestAt || !newestAt) return '';
  const oldest = new Date(oldestAt);
  const newest = new Date(newestAt);
  if (Number.isNaN(oldest.getTime()) || Number.isNaN(newest.getTime())) return '';
  const diffMs = Math.abs(newest.getTime() - oldest.getTime());
  const days = Math.floor(diffMs / 86_400_000);
  if (days < 1) return 'today';
  if (days < 30) return `${days} day${days === 1 ? '' : 's'}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'}`;
}

export const SIGNAL_TYPE_PILL_CLASS =
  'text-caption px-3 py-1.5 rounded-full border border-accent/40 bg-accent/10 text-accent-light font-sans';
