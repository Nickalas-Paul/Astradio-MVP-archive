'use client';

import Link from 'next/link';
import { useRelationalCommunityFeed, type ProfilePrimaryChart } from '../../core/social/hooks';

interface RelationalCommunityFeedProps {
  userId: string | null;
  primaryChart: ProfilePrimaryChart | null;
  className?: string;
}

/**
 * Relational weather over established connections only (pairs, relational groups, campaigns).
 * Ordering is server-defined; no client-side resorting.
 */
export function RelationalCommunityFeed({ userId, primaryChart, className = '' }: RelationalCommunityFeedProps) {
  const { data, isLoading, error, refresh } = useRelationalCommunityFeed(userId, primaryChart);

  if (!userId) {
    return (
      <div className={`rounded-lg border border-border bg-surface-1 p-4 text-sm text-subtext ${className}`}>
        Sign in to load your relational feed.
      </div>
    );
  }

  if (isLoading && !data) {
    return <div className={`text-subtext text-sm p-4 ${className}`}>Loading relational feed…</div>;
  }

  if (error) {
    return (
      <div className={`rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-800 dark:text-amber-200 ${className}`}>
        {error}
        <button type="button" onClick={() => refresh()} className="ml-3 underline text-emerald-600 dark:text-emerald-400">
          Retry
        </button>
      </div>
    );
  }

  const items = data?.items ?? [];

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-text">Relational weather</h3>
        <button
          type="button"
          onClick={() => refresh()}
          className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
        >
          Refresh
        </button>
      </div>
      <p className="text-xs text-subtext">
        Ranked by effective activation (weather + relational), then relational intensity, for your established connections at this moment (
        <span className="font-mono text-text/80">{data?.sort_tuple_version ?? '—'}</span>
        ). Not discovery.{' '}
        <Link href="/community?tab=connections" className="text-emerald hover:underline">
          Open Signals
        </Link>{' '}
        for structured actions.
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-subtext">No established connections yet. Use Discovery to request connections or join groups.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.feed_item_id}
              className="rounded-lg border border-border bg-surface-1 p-4 space-y-1"
            >
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-text capitalize">{item.connection_kind.replace('_', ' ')}</span>
                <span className="text-subtext font-mono text-xs truncate max-w-[200px]" title={item.binding_id}>
                  {item.binding_id}
                </span>
              </div>
              <p className="text-xs text-subtext font-mono break-all">
                Charts: {item.chart_ids_ordered.join(', ')}
              </p>
              <div className="flex flex-wrap gap-3 text-xs text-subtext pt-1">
                <span>effective: {item.ranking.activation_effective.toFixed(4)}</span>
                <span>weather: {item.ranking.weather_activation_intensity.toFixed(4)}</span>
                <span>relational: {item.ranking.overall_relational_intensity.toFixed(4)}</span>
                <Link
                  href="/community?tab=connections&signals=1"
                  className="text-emerald hover:underline"
                >
                  Signals
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
