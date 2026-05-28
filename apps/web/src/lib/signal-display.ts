const SIGNAL_TEMPLATE_LABELS: Record<string, string> = {
  resonates: 'Resonates',
  feeling_this: 'Feeling this',
  lets_pay_attention: "Let's pay attention",
  challenge_accepted: 'Challenge accepted',
};

export function formatSignalTemplateLabel(templateId: string): string {
  const key = templateId.trim();
  if (SIGNAL_TEMPLATE_LABELS[key]) return SIGNAL_TEMPLATE_LABELS[key]!;
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatSignalSentRelativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Sent recently';

  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Sent just now';
  if (diffMin < 60) return `Sent ${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `Sent ${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sentDay = new Date(d);
  sentDay.setHours(0, 0, 0, 0);
  if (sentDay.getTime() === today.getTime()) return 'Sent today';

  return `Sent ${d.toLocaleDateString()}`;
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
    if (id.startsWith('pair:')) return `Feed · ${id.slice(5, 21)}${id.length > 21 ? '…' : ''}`;
    return `Feed · ${id.slice(0, 20)}${id.length > 20 ? '…' : ''}`;
  }
  return `${anchorType} · ${id.slice(0, 24)}${id.length > 24 ? '…' : ''}`;
}

/** UTC day start — matches server dedupe window for feed signal status. */
export function isSignalCreatedTodayUtc(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  return d >= todayStart;
}
