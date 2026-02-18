'use client';

import { MemberCard } from './MemberCard';
import { bandLabel } from '@/lib/compat-intent';

export interface ClusterMember {
  userId: string;
  chartId: string;
  displayName?: string;
  descriptors?: string[];
  sharedContext?: string[];
}

export interface Cluster {
  id: string;
  label: string;
  band: string;
  members: ClusterMember[];
  why: { bullets: string[] };
}

interface ClusterCardsProps {
  clusters: Cluster[];
  seekerChartId: string | null;
  keywordFilter?: string;
}

export function ClusterCards({ clusters, seekerChartId, keywordFilter }: ClusterCardsProps) {
  const filterMember = (m: ClusterMember) => {
    if (!keywordFilter?.trim()) return true;
    const k = keywordFilter.trim().toLowerCase();
    const dn = (m.displayName || '').toLowerCase();
    const ctx = (m.sharedContext || []).join(' ').toLowerCase();
    const desc = (m.descriptors || []).join(' ').toLowerCase();
    return dn.includes(k) || ctx.includes(k) || desc.includes(k);
  };

  return (
    <div className="space-y-8">
      {clusters.map((cluster) => {
        const members = cluster.members.filter(filterMember).slice(0, 12);
        if (members.length === 0) return null;

        return (
          <article
            key={cluster.id}
            className="rounded-lg border border-border bg-surface-1 p-6"
          >
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-lg font-semibold text-text">{cluster.label}</h2>
              <span className="px-2 py-0.5 rounded-full bg-surface-2 text-xs text-subtext">
                {bandLabel(cluster.band)}
              </span>
            </div>
            {cluster.why?.bullets && cluster.why.bullets.length > 0 && (
              <ul className="list-disc list-inside text-sm text-subtext mb-4 space-y-1">
                {cluster.why.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {members.map((m) => (
                <MemberCard
                  key={m.chartId}
                  member={m}
                  seekerChartId={seekerChartId}
                  band={cluster.band}
                />
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}
