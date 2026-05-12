'use client';

import { useState } from 'react';
import { CompatibilityLensModal } from './CompatibilityLensModal';
import { bandLabel } from '@/lib/compat-intent';

export interface MemberCardMember {
  userId: string;
  chartId: string;
  displayName?: string;
  descriptors?: string[];
  sharedContext?: string[];
  explanationProfile?: {
    intentFitSummary: string;
    primarySupports: string[];
    secondarySupports: string[];
    tensionsOrLimits: string[];
    contrastByIntent: {
      friend: 'high' | 'moderate' | 'low';
      lover: 'high' | 'moderate' | 'low';
    };
    anchors: string[];
  };
}

interface MemberCardProps {
  member: MemberCardMember;
  seekerChartId: string | null;
  band: string;
}

export function MemberCard({ member, seekerChartId, band }: MemberCardProps) {
  const [lensOpen, setLensOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const displayName = member.displayName || member.userId || 'Unknown';

  return (
    <>
      <div className="rounded-lg border border-border bg-surface-1 p-3 flex flex-col gap-2">
        <div className="font-medium text-text text-sm">{displayName}</div>
        {member.descriptors && member.descriptors.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {member.descriptors.slice(0, 3).map((d, i) => (
              <span key={i} className="px-2 py-0.5 rounded bg-surface-2 text-xs text-subtext">
                {d}
              </span>
            ))}
          </div>
        )}
        {member.sharedContext && member.sharedContext.length > 0 && (
          <p className="text-xs text-subtext line-clamp-2">{member.sharedContext[0]}</p>
        )}
        {member.explanationProfile && (
          <div className="text-xs text-subtext space-y-1">
            <p>
              <span className="font-medium text-text">Support:</span>{' '}
              {member.explanationProfile.primarySupports[0] ?? 'Support signal unavailable'}
            </p>
            <p>
              <span className="font-medium text-text">Limit:</span>{' '}
              {member.explanationProfile.tensionsOrLimits[0] ?? 'Limit signal unavailable'}
            </p>
          </div>
        )}
        {expanded && member.explanationProfile && (
          <div className="rounded border border-border bg-surface-2 p-2 text-xs text-subtext space-y-1">
            <p className="font-medium text-text">{member.explanationProfile.intentFitSummary}</p>
            {member.explanationProfile.secondarySupports.slice(0, 2).map((line) => (
              <p key={`${member.chartId}-secondary-${line}`}>- {line}</p>
            ))}
            {member.explanationProfile.anchors.length > 0 && (
              <p>Anchors: {member.explanationProfile.anchors.join(', ')}</p>
            )}
          </div>
        )}
        {member.chartId && (
          <div className="mt-auto flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="self-start px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-sm text-text"
            >
              {expanded ? 'Hide details' : 'Details'}
            </button>
            <button
              type="button"
              onClick={() => setLensOpen(true)}
              className="self-start px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-sm text-text"
            >
              Compatibility Lens
            </button>
          </div>
        )}
      </div>

      {lensOpen && member.chartId && (
        <CompatibilityLensModal
          seekerChartId={seekerChartId}
          targetChartId={member.chartId}
          targetDisplayName={displayName}
          onClose={() => setLensOpen(false)}
        />
      )}
    </>
  );
}
