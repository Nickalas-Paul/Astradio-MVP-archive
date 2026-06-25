'use client';

import { useState } from 'react';
import { Button } from '@/components/shared/Button';
import {
  REPORT_REASONS,
  submitCommunityReport,
  type ReportReasonValue,
  type ReportTargetType,
} from '@/lib/community-report';
import { useUIStore } from '@/store';

export interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  onReported?: () => void;
}

export function ReportModal({
  open,
  onClose,
  targetType,
  targetId,
  onReported,
}: ReportModalProps) {
  const addToast = useUIStore((s) => s.addToast);
  const [reason, setReason] = useState<ReportReasonValue>(REPORT_REASONS[0].value);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await submitCommunityReport({ targetType, targetId, reason });
      addToast({ type: 'success', title: 'Reported', duration: 2500 });
      onReported?.();
      onClose();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not submit report';
      setError(message);
      addToast({ type: 'error', title: 'Could not submit report', message, duration: 3500 });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-bgElev p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="report-modal-title" className="text-h4 font-serif font-semibold text-text-primary mb-2">
          Report
        </h2>
        <p className="text-sm text-text-secondary mb-4">Select a reason for your report.</p>
        <fieldset className="space-y-2 mb-4">
          {REPORT_REASONS.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 cursor-pointer hover:bg-surface-1 has-[:checked]:border-accent/60"
            >
              <input
                type="radio"
                name="report-reason"
                value={option.value}
                checked={reason === option.value}
                onChange={() => setReason(option.value)}
                className="accent-accent"
              />
              <span className="text-sm text-text-primary">{option.label}</span>
            </label>
          ))}
        </fieldset>
        {error ? (
          <p className="text-sm text-red-400 mb-3" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="ghost" size="sm" disabled={submitting} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="primary" size="sm" loading={submitting} onClick={() => void handleSubmit()}>
            Submit
          </Button>
        </div>
      </div>
    </div>
  );
}
