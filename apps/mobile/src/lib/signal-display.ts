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

function formatSignalRelativeTime(iso: string, prefix: 'Sent' | 'Received'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return `${prefix} recently`;

  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return `${prefix} just now`;
  if (diffMin < 60) return `${prefix} ${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${prefix} ${diffHr}h ago`;

  return `${prefix} ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

export function formatSignalSentRelativeTime(iso: string): string {
  return formatSignalRelativeTime(iso, 'Sent');
}

export function formatSignalReceivedRelativeTime(iso: string): string {
  return formatSignalRelativeTime(iso, 'Received');
}

export function formatSignalActivityRelativeTime(iso: string): string {
  const raw = formatSignalRelativeTime(iso, 'Sent');
  if (raw === 'Sent recently') return 'recently';
  if (raw.startsWith('Sent ')) return raw.slice(5);
  return raw;
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

export function formatDmRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function peerDisplayLabel(peer: {
  displayName?: string | null;
  handle?: string | null;
} | null | undefined): string {
  if (!peer) return 'Unknown';
  if (peer.displayName?.trim()) return peer.displayName.trim();
  if (peer.handle?.trim()) return `@${peer.handle.trim()}`;
  return 'Someone';
}

export const MESSAGE_MAX = 1000;
