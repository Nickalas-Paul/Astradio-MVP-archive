export const REPORT_REASONS = [
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'other', label: 'Other' },
] as const;

export type ReportTargetType = 'post' | 'user' | 'message';
export type ReportReasonValue = (typeof REPORT_REASONS)[number]['value'];

export async function submitCommunityReport(params: {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReasonValue;
}): Promise<{ id: string; createdAt?: string }> {
  const r = await fetch('/api/community/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({
      targetType: params.targetType,
      targetId: params.targetId,
      reason: params.reason,
    }),
  });
  const data = (await r.json().catch(() => ({}))) as { error?: string; id?: string; createdAt?: string };
  if (!r.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Could not submit report');
  }
  if (!data.id) {
    throw new Error('Could not submit report');
  }
  return { id: data.id, createdAt: data.createdAt };
}
