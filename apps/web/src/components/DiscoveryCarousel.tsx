'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CompatMatch, CompatibilityExplanationProfile, SynastryBulletLine } from '../core/compat/types';
import type { RelationalIntent } from '../lib/relational-intent';
import { IdentityMarkdown } from '@/components/shared/IdentityMarkdown';
import { Button } from '@/components/shared/Button';
import { Card } from '@/components/shared/Card';

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
  const label = line.anchor?.trim();
  return (
    <div className="min-w-0 space-y-1">
      {label ? (
        <p className="text-caption font-medium uppercase tracking-wide text-accent">{label}</p>
      ) : null}
      <div className="text-body text-text-primary leading-relaxed">
        <IdentityMarkdown content={line.text} />
      </div>
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
  /** Viewer's chart ID for /listen deep links from match cards. */
  viewerChartId: string | null;
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
      <h2 className="text-h3 font-serif font-semibold text-text-primary mb-2">
        Cosmic weather for {dateStr}
      </h2>
      <p className="text-body-sm text-text-secondary">
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

  return <p className="text-caption text-text-muted">New matches in: {timeUntilRefresh}</p>;
}

function CarouselNavButton({
  direction,
  disabled,
  onClick,
}: {
  direction: 'prev' | 'next';
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="hidden md:flex shrink-0 w-12 h-12 rounded-full border border-border bg-surface-1 items-center justify-center text-text-secondary hover:bg-bgElev hover:text-text-primary active:scale-[0.97] active:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-fast ease-aurora"
      aria-label={direction === 'prev' ? 'Previous match' : 'Next match'}
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        {direction === 'prev' ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        )}
      </svg>
    </button>
  );
}

function CarouselFooter({
  currentIndex,
  totalMatches,
  requestsRemaining,
  onSelectIndex,
}: {
  currentIndex: number;
  totalMatches: number;
  requestsRemaining: number;
  onSelectIndex: (index: number) => void;
}) {
  return (
    <footer className="mt-8 flex flex-col items-center gap-3">
      <div className="flex gap-2" role="tablist" aria-label="Match position">
        {Array.from({ length: totalMatches }).map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === currentIndex}
            aria-label={`Match ${i + 1} of ${totalMatches}`}
            onClick={() => onSelectIndex(i)}
            className={`touch-target p-3 rounded-full transition-all duration-fast ${
              i === currentIndex ? 'bg-accent' : 'bg-transparent hover:bg-surface-2/80'
            }`}
          >
            <span
              className={`block w-2.5 h-2.5 rounded-full ${
                i === currentIndex ? 'bg-accent scale-110' : 'bg-surface-2'
              }`}
              aria-hidden
            />
          </button>
        ))}
      </div>
      <p className="text-caption text-text-muted text-center">
        Card {currentIndex + 1} of {totalMatches}
        <span className="mx-2" aria-hidden>
          ·
        </span>
        {requestsRemaining} requests remaining
      </p>
      <RefreshCountdown />
    </footer>
  );
}

function MatchCard({
  match,
  intent,
  onViewProfile,
  onRequestConnection,
  onHearConnection,
  connectionLabel,
  connectionDisabled,
  hearConnectionDisabled,
}: {
  match: CompatMatch;
  intent: RelationalIntent;
  onViewProfile: () => void;
  onRequestConnection: () => void;
  onHearConnection: () => void;
  connectionLabel: string;
  connectionDisabled: boolean;
  hearConnectionDisabled: boolean;
}) {
  const ep = match.explanationProfile;
  const bullets = [
    discoveryBulletFromEp(ep, 'forThem'),
    discoveryBulletFromEp(ep, 'forYou'),
    discoveryBulletFromEp(ep, 'together'),
  ];
  const initial =
    (match.displayName || match.userId || '?').trim().charAt(0).toUpperCase() || '?';
  const intentLabel = intent === 'lover' ? 'partner' : 'friend';

  return (
    <Card
      elevation="raised"
      size="lg"
      interactive
      className="match-card w-full max-w-lg mx-auto px-1 sm:px-0 space-y-6"
    >
      <div className="flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-full bg-surface-0 border border-border flex items-center justify-center overflow-hidden mb-3">
          {match.avatarUrl ? (
            <img
              src={match.avatarUrl}
              alt=""
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="font-serif text-h4 font-medium text-text-primary">{initial}</span>
          )}
        </div>
        <h3 className="font-serif text-h3 font-semibold text-text-primary">{match.displayName}</h3>
        {match.bio ? (
          <p className="text-body-sm text-text-secondary mt-2 line-clamp-2 max-w-md font-sans">{match.bio}</p>
        ) : null}
        {match.chartHighlights && match.chartHighlights.length > 0 ? (
          <ul className="flex flex-wrap justify-center gap-1.5 mt-3 max-w-md">
            {match.chartHighlights.map((h) => (
              <li
                key={h}
                className="text-caption px-2 py-0.5 rounded-full border border-accent/40 bg-accent/10 text-accent font-sans"
              >
                {h}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="border-t border-border" aria-hidden="true" />

      <ul className="space-y-4">
        {bullets.map((line, idx) => (
          <li key={idx}>
            <SynastryBulletBlock line={line} />
          </li>
        ))}
      </ul>

      <div className="flex flex-col sm:flex-row gap-3 w-full">
        <Button
          type="button"
          variant="outline"
          size="md"
          className="w-full sm:flex-1 min-h-[44px]"
          onClick={onViewProfile}
        >
          View profile
        </Button>
        <Button
          type="button"
          variant="primary"
          size="md"
          className="w-full sm:flex-1 min-h-[44px]"
          onClick={onRequestConnection}
          disabled={connectionDisabled}
          loading={connectionLabel === 'Sending…'}
        >
          {connectionLabel}
        </Button>
        <Button
          type="button"
          variant="audio"
          size="md"
          className="w-full sm:flex-1 min-h-[44px]"
          onClick={onHearConnection}
          disabled={hearConnectionDisabled}
        >
          Hear this connection
        </Button>
      </div>
      <p className="sr-only">Browsing as {intentLabel} intent</p>
    </Card>
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
  viewerChartId,
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
        <h3 className="text-h4 font-semibold text-text-primary mb-2">No matches found today</h3>
        <p className="text-body-sm text-text-secondary mb-2">
          Today&apos;s cosmic weather didn&apos;t highlight connections for this intent.
        </p>
        <p className="text-body-sm text-text-secondary">
          Try switching to {altIntent} intent, or check back tomorrow.
        </p>
      </div>
    );
  }

  if (requestsRemaining === 0 && pendingOutgoingCount >= MAX_OUTGOING_CONNECTION_REQUESTS) {
    return (
      <div className="text-center py-10 px-4">
        <CosmicWeatherHeader />
        <h3 className="text-h4 font-semibold text-text-primary mb-2">All connection requests pending</h3>
        <p className="text-body-sm text-text-secondary mb-2">
          You have {pendingOutgoingCount} requests awaiting response.
        </p>
        <p className="text-body-sm text-text-secondary mb-6">
          You can send more when someone accepts, declines, or you cancel a pending request.
        </p>
        <Button
          type="button"
          variant="primary"
          size="md"
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
      className="max-w-3xl mx-auto px-3 sm:px-4"
      role="region"
      aria-label="Discovery matches carousel"
      aria-live="polite"
    >
      <CosmicWeatherHeader />

      <div
        className="relative flex items-stretch md:items-center justify-center gap-2 md:gap-3 min-h-0 md:min-h-[28rem]"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <CarouselNavButton direction="prev" disabled={safeIndex === 0} onClick={handlePrevious} />

        <div aria-label={`Match ${safeIndex + 1} of ${totalMatches}`} className="flex-1 min-w-0">
          <MatchCard
            match={currentMatch}
            intent={intent}
            onViewProfile={() => onViewProfile(currentMatch)}
            onRequestConnection={() => onRequestConnection(currentMatch)}
            onHearConnection={() => {
              if (!viewerChartId) return;
              router.push(
                `/listen?chartA=${encodeURIComponent(viewerChartId)}&chartB=${encodeURIComponent(currentMatch.chartId)}`
              );
            }}
            connectionLabel={connectionLabel}
            connectionDisabled={connectionDisabled}
            hearConnectionDisabled={!viewerChartId}
          />
        </div>

        <CarouselNavButton
          direction="next"
          disabled={safeIndex >= totalMatches - 1}
          onClick={handleNext}
        />
      </div>

      <CarouselFooter
        currentIndex={safeIndex}
        totalMatches={totalMatches}
        requestsRemaining={requestsRemaining}
        onSelectIndex={setCurrentIndex}
      />
    </div>
  );
}
