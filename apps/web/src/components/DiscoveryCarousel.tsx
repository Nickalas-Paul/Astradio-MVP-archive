'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CompatMatch, CompatibilityExplanationProfile, SynastryBulletLine } from '../core/compat/types';
import type { RelationalIntent } from '../lib/relational-intent';
import { IdentityMarkdown } from '@/components/shared/IdentityMarkdown';
import { Button } from '@/components/shared/Button';

const MAX_OUTGOING_CONNECTION_REQUESTS = 3;

/** Shown above each Discovery bullet; backend sets anchor (142ad8a+), UI fills if API is stale. */
const DISCOVERY_BULLET_LABELS: Record<'forThem' | 'forYou' | 'together', string> = {
  forThem: "Why you're good for them",
  forYou: "Why they're good for you",
  together: "Why you're good together",
};

export function calculateDiscoveryRequestsRemaining(pendingOutgoingCount: number): number {
  return Math.max(0, MAX_OUTGOING_CONNECTION_REQUESTS - pendingOutgoingCount);
}

export function formatRefreshCountdown(now: Date = new Date()): string {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const diff = Math.max(0, tomorrow.getTime() - now.getTime());
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

function discoveryBulletFromEp(
  ep: CompatibilityExplanationProfile,
  which: 'forYou' | 'forThem' | 'together'
): SynastryBulletLine {
  const label = DISCOVERY_BULLET_LABELS[which];
  const structured = ep.synastryBullets?.[which];
  if (structured?.text) {
    return {
      anchor: structured.anchor?.trim() || label,
      text: structured.text,
    };
  }
  const fallback =
    which === 'forYou'
      ? ep.primarySupports[0]
      : which === 'forThem'
        ? ep.secondarySupports[0]
        : ep.tensionsOrLimits[0];
  return { anchor: label, text: fallback || 'Compatibility insight unavailable' };
}

function SynastryBulletBlock({ line }: { line: SynastryBulletLine }) {
  if (line.anchor) {
    return (
      <div className="min-w-0">
        <div className="text-xs font-semibold text-subtext mb-1">{line.anchor}</div>
        <div className="text-sm">
          <IdentityMarkdown content={line.text} />
        </div>
      </div>
    );
  }
  return (
    <div className="text-sm min-w-0">
      <IdentityMarkdown content={line.text} />
    </div>
  );
}

export interface DiscoveryCarouselProps {
  matches: CompatMatch[];
  intent: RelationalIntent;
  requestsRemaining: number;
  pendingOutgoingCount: number;
  onViewProfile: (match: CompatMatch) => void;
  onRequestConnection: (match: CompatMatch) => void;
  isConnectionPending: (match: CompatMatch) => boolean;
  connectionBusyChartId: string | null;
  canRequestConnection: boolean;
}

function CosmicWeatherHeader() {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <header className="text-center mb-8">
      <h2 className="text-xl font-semibold text-text mb-2">Cosmic weather for {dateStr}</h2>
      <p className="text-sm text-subtext">
        Astrological patterns highlighting today&apos;s connections
      </p>
    </header>
  );
}

function RefreshCountdown() {
  const [timeUntilRefresh, setTimeUntilRefresh] = useState(() => formatRefreshCountdown());

  useEffect(() => {
    const update = () => setTimeUntilRefresh(formatRefreshCountdown());
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, []);

  return <p className="text-xs text-subtext">New matches in: {timeUntilRefresh}</p>;
}

function CarouselFooter({
  currentIndex,
  totalMatches,
  requestsRemaining,
}: {
  currentIndex: number;
  totalMatches: number;
  requestsRemaining: number;
}) {
  return (
    <footer className="mt-8 flex flex-col items-center gap-3">
      <div className="flex gap-2" role="tablist" aria-label="Match position">
        {Array.from({ length: totalMatches }).map((_, i) => (
          <span
            key={i}
            role="tab"
            aria-selected={i === currentIndex}
            className={`h-2 w-2 rounded-full transition-all ${
              i === currentIndex ? 'bg-emerald scale-125' : 'bg-border'
            }`}
          />
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-4 text-sm text-subtext">
        <span>
          Card {currentIndex + 1} of {totalMatches}
        </span>
        <span>{requestsRemaining} requests remaining</span>
      </div>
      <RefreshCountdown />
    </footer>
  );
}

function MatchCard({
  match,
  intent,
  onViewProfile,
  onRequestConnection,
  connectionLabel,
  connectionDisabled,
}: {
  match: CompatMatch;
  intent: RelationalIntent;
  onViewProfile: () => void;
  onRequestConnection: () => void;
  connectionLabel: string;
  connectionDisabled: boolean;
}) {
  const ep = match.explanationProfile;
  const forThemLine = discoveryBulletFromEp(ep, 'forThem');
  const forYouLine = discoveryBulletFromEp(ep, 'forYou');
  const togetherLine = discoveryBulletFromEp(ep, 'together');
  const initial =
    (match.displayName || match.userId || '?').trim().charAt(0).toUpperCase() || '?';
  const intentLabel = intent === 'lover' ? 'partner' : 'friend';

  return (
    <article className="match-card w-full max-w-lg mx-auto p-6 bg-bgElev rounded-xl border border-border">
      <div className="flex flex-col items-center mb-6">
        <div className="w-20 h-20 rounded-full bg-bg border border-border flex items-center justify-center overflow-hidden mb-3">
          {match.avatarUrl ? (
            <img
              src={match.avatarUrl}
              alt=""
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="text-lg font-medium text-text">{initial}</span>
          )}
        </div>
        <h3 className="text-lg font-semibold text-text">{match.displayName}</h3>
        {match.bio ? (
          <p className="text-sm text-subtext mt-2 text-center line-clamp-2">{match.bio}</p>
        ) : null}
      </div>

      <div className="mb-6">
        <h4 className="text-sm font-medium text-text mb-3">Why you&apos;re compatible</h4>
        <ul className="space-y-3">
          {[forThemLine, forYouLine, togetherLine].map((line, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="text-emerald text-xs mt-1 shrink-0" aria-hidden>
                ●
              </span>
              <SynastryBulletBlock line={line} />
            </li>
          ))}
        </ul>
      </div>

      {match.lookingFor ? (
        <p className="text-xs text-subtext italic border-l-2 border-emerald/30 pl-2 mb-6">
          &ldquo;{match.lookingFor}&rdquo;
        </p>
      ) : null}

      <div className="flex flex-wrap justify-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={onViewProfile}>
          View profile
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={onRequestConnection}
          disabled={connectionDisabled}
        >
          {connectionLabel}
        </Button>
      </div>
      <p className="sr-only">Browsing as {intentLabel} intent</p>
    </article>
  );
}

export function DiscoveryCarousel({
  matches,
  intent,
  requestsRemaining,
  pendingOutgoingCount,
  onViewProfile,
  onRequestConnection,
  isConnectionPending,
  connectionBusyChartId,
  canRequestConnection,
}: DiscoveryCarouselProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  const totalMatches = matches.length;
  const safeIndex = totalMatches > 0 ? Math.min(currentIndex, totalMatches - 1) : 0;
  const currentMatch = matches[safeIndex];

  const handleNext = useCallback(() => {
    setCurrentIndex((i) => (i < matches.length - 1 ? i + 1 : i));
  }, [matches.length]);

  const handlePrevious = useCallback(() => {
    setCurrentIndex((i) => (i > 0 ? i - 1 : i));
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrevious();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleNext, handlePrevious]);

  useEffect(() => {
    const card = document.querySelector('.match-card');
    const firstButton = card?.querySelector('button');
    firstButton?.focus();
  }, [safeIndex]);

  useEffect(() => {
    setCurrentIndex(0);
  }, [matches, intent]);

  useEffect(() => {
    if (currentIndex >= matches.length && matches.length > 0) {
      setCurrentIndex(matches.length - 1);
    }
  }, [currentIndex, matches.length]);

  if (matches.length === 0) {
    const altIntent = intent === 'lover' ? 'Friend' : 'Partner';
    return (
      <div className="text-center py-10 px-4">
        <h3 className="text-lg font-semibold text-text mb-2">No matches found today</h3>
        <p className="text-sm text-subtext mb-2">
          Today&apos;s cosmic weather didn&apos;t highlight connections for this intent.
        </p>
        <p className="text-sm text-subtext">
          Try switching to {altIntent} intent, or check back tomorrow.
        </p>
      </div>
    );
  }

  if (requestsRemaining === 0 && pendingOutgoingCount >= MAX_OUTGOING_CONNECTION_REQUESTS) {
    return (
      <div className="text-center py-10 px-4">
        <CosmicWeatherHeader />
        <h3 className="text-lg font-semibold text-text mb-2">All connection requests pending</h3>
        <p className="text-sm text-subtext mb-2">
          You have {pendingOutgoingCount} requests awaiting response.
        </p>
        <p className="text-sm text-subtext mb-6">
          You can send more when someone accepts, declines, or you cancel a pending request.
        </p>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => router.push('/community?tab=connections')}
        >
          View pending requests
        </Button>
      </div>
    );
  }

  if (!currentMatch) {
    return null;
  }

  const pending = isConnectionPending(currentMatch);
  const connectionDisabled =
    !canRequestConnection || pending || connectionBusyChartId === currentMatch.chartId;
  const connectionLabel = pending
    ? 'Awaiting response'
    : connectionBusyChartId === currentMatch.chartId
      ? 'Sending…'
      : 'Request connection';

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0]?.clientX ?? 0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0]?.clientX ?? 0);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const threshold = 50;
    if (distance > threshold) handleNext();
    else if (distance < -threshold) handlePrevious();
    setTouchStart(0);
    setTouchEnd(0);
  };

  return (
    <div
      className="max-w-3xl mx-auto px-2"
      role="region"
      aria-label="Discovery matches carousel"
      aria-live="polite"
    >
      <CosmicWeatherHeader />

      <div
        className="relative flex items-center justify-center gap-3 min-h-[28rem]"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <button
          type="button"
          onClick={handlePrevious}
          disabled={safeIndex === 0}
          className="hidden md:flex shrink-0 h-12 w-12 items-center justify-center rounded-full border border-border text-xl text-subtext hover:bg-bgElev hover:text-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous match"
        >
          ←
        </button>

        <div aria-label={`Match ${safeIndex + 1} of ${totalMatches}`} className="flex-1 min-w-0">
          <MatchCard
            match={currentMatch}
            intent={intent}
            onViewProfile={() => onViewProfile(currentMatch)}
            onRequestConnection={() => onRequestConnection(currentMatch)}
            connectionLabel={connectionLabel}
            connectionDisabled={connectionDisabled}
          />
        </div>

        <button
          type="button"
          onClick={handleNext}
          disabled={safeIndex >= totalMatches - 1}
          className="hidden md:flex shrink-0 h-12 w-12 items-center justify-center rounded-full border border-border text-xl text-subtext hover:bg-bgElev hover:text-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Next match"
        >
          →
        </button>
      </div>

      <CarouselFooter
        currentIndex={safeIndex}
        totalMatches={totalMatches}
        requestsRemaining={requestsRemaining}
      />
    </div>
  );
}
