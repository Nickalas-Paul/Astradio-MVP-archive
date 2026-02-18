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
}

interface MemberCardProps {
  member: MemberCardMember;
  seekerChartId: string | null;
  band: string;
}

export function MemberCard({ member, seekerChartId, band }: MemberCardProps) {
  const [lensOpen, setLensOpen] = useState(false);

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
        {member.chartId && (
          <button
            type="button"
            onClick={() => setLensOpen(true)}
            className="mt-auto self-start px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-sm text-text"
          >
            Compatibility Lens
          </button>
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
