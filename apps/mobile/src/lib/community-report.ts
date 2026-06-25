import { api } from './api';

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
}): Promise<void> {
  await api('/api/community/report', {
    method: 'POST',
    body: JSON.stringify({
      targetType: params.targetType,
      targetId: params.targetId,
      reason: params.reason,
    }),
  });
}
