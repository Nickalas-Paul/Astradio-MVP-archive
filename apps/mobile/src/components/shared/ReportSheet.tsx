import { Alert } from 'react-native';
import {
  REPORT_REASONS,
  submitCommunityReport,
  type ReportReasonValue,
  type ReportTargetType,
} from '../../lib/community-report';
import { formatApiError } from '../../lib/format-api-error';

export function openReportSheet(params: {
  targetType: ReportTargetType;
  targetId: string;
  onReported?: () => void;
}): void {
  const buttons = [
    ...REPORT_REASONS.map((option) => ({
      text: option.label,
      onPress: () => {
        void submitReport(params.targetType, params.targetId, option.value, params.onReported);
      },
    })),
    { text: 'Cancel', style: 'cancel' as const },
  ];

  Alert.alert('Report', 'Why are you reporting this?', buttons);
}

async function submitReport(
  targetType: ReportTargetType,
  targetId: string,
  reason: ReportReasonValue,
  onReported?: () => void
): Promise<void> {
  try {
    await submitCommunityReport({ targetType, targetId, reason });
    onReported?.();
    Alert.alert('Reported', 'Thank you. We will review this report.');
  } catch (err) {
    Alert.alert('Could not submit report', formatApiError(err, 'Something went wrong'));
  }
}
