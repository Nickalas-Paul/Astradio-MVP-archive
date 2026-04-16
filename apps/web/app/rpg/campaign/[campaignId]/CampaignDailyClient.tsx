'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { LocationFinder, type GeocodeResult } from '@/components/sandbox/LocationFinder';

type CampaignStateMember = {
  tone_track?: Record<string, number>;
  domain_track?: Record<string, number>;
  flags?: string[];
  history?: string[];
};

type CampaignState = {
  chapter?: number;
  flags?: string[];
  domain_track?: Record<string, number>;
  tone_track?: Record<string, number>;
  history?: string[];
  members?: Record<string, CampaignStateMember>;
};

type CampaignRecord = {
  campaignId: string;
  mode: 'solo' | 'group' | 'auto';
  stateJson: CampaignState;
  stateHash: string;
  stateVersion: number;
};

type ResponseChoice = {
  id: string;
  label: string;
  symbolicGesture: string;
  patternTag: string;
  posture: string;
  modality: string;
  riskProfile: string;
  outcomeDirection: string;
};

type DailyResponse = {
  campaignId: string;
  calendarDate: string;
  engineVersion: string;
  mode: string;
  fromCache: boolean;
  anchorUserId: string | null;
  transitContextFingerprint: string;
  daily: {
    daily: {
      character_sheet: {
        id: string;
        class_slug: string;
        subclass_slug: string;
        rising_modifier_slug: string;
        top_domains: Array<{ domain: string; score: number }>;
      };
      challenge_archetype: {
        id: string;
        primary_transit_body: string;
        primary_natal_body: string;
        primary_natal_house: number;
        primary_aspect_type: string;
        primary_pressure_family: string;
        primary_domain_id: string;
        primary_intensity_band: string;
        primary_intensity_score: number;
        interaction_type: string;
        event_count: number;
        archetype_category: string;
        supporting_domain_pattern: string[];
        supporting_family_pattern: string[];
        supporting_member_chart_ids: string[];
        primary_member_chart_ids: string[];
      };
      challenge: {
        id: string;
        archetypeCategory?: string;
        theme: string;
        setting: string;
        obstacle: string;
        primaryPressure: {
          transitBody: string;
          natalBody: string;
          natalHouse: number;
          aspectType: string;
          type: string;
          domain: string;
          pressureFamily: string;
          intensityBand: string;
          lifeArea: string;
        };
        supportingPressures: Array<{
          id: string;
          type: string;
          domain: string;
          lifeArea: string;
        }>;
        choices: ResponseChoice[];
      };
      response_paths: Array<{
        path_id: string;
        pattern_tag: string;
        posture: string;
        modality: string;
        risk_profile: string;
        outcome_direction: string;
        domain_context: string;
        interaction_context: string;
        intensity_band: string;
        ordinal: number;
      }>;
      response_collection: {
        accepted_response_count: number;
        members_total: number;
        ready_member_chart_ids: string[];
        pending_member_chart_ids: string[];
        accepted_responses: Record<
          string,
          {
            member_id: string;
            user_id: string;
            choice_id: string;
            response_path_id: string;
            response_pattern_tag: string;
            response_posture: string;
            response_label: string;
            accepted_at: string | null;
          }
        >;
      };
      participant_roster: Array<{ user_id: string; chart_id: string; ordinal: number }>;
      challenge_fingerprint: string;
      state_hash_before: string;
    };
    resolution: null | {
      challenge_fingerprint: string;
      response_count: number;
      resolved_member_chart_ids: string[];
      state_hash_after: string;
      resolved_at: string;
      ordered_member_resolutions: Array<{
        member_id: string;
        user_id: string;
        choice_id: string;
        outcome_patch_id: string;
        response_path_id: string;
        response_pattern_tag: string;
        response_posture: string;
        response_label: string;
      }>;
    };
  };
};

type ResolveResponse = {
  acceptedResponse?: {
    member_id: string;
    choice_id: string;
    response_pattern_tag: string;
    response_posture: string;
    response_label: string;
  };
  responseCollection?: DailyResponse['daily']['daily']['response_collection'];
  readiness?: {
    is_ready: boolean;
    accepted_response_count: number;
    members_total: number;
    ready_member_chart_ids: string[];
    pending_member_chart_ids: string[];
  };
  resolution: DailyResponse['daily']['resolution'];
  newState: CampaignState;
  stateHash: string;
  stateVersion: number;
};

type SurfaceErrorState = {
  title: string;
  description: string;
  tone: 'warning' | 'danger' | 'neutral';
};

function initialDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function initialTime() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function titleCase(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function sentenceCase(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed[0].toUpperCase() + trimmed.slice(1);
}

function topTrackEntry(track?: Record<string, number>) {
  return Object.entries(track || {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? null;
}

function describeTone(toneKey?: string) {
  switch (toneKey) {
    case 'clarity':
      return '[tone_track] Weight on clarity — lines are reading sharper in aggregate.';
    case 'momentum':
      return '[tone_track] Weight on momentum — follow-through is carrying the trend.';
    case 'ambiguity':
      return '[tone_track] Weight on ambiguity — resolution is intentionally deferred in aggregate.';
    case 'containment':
      return '[tone_track] Weight on containment — boundaries and exposure caps dominate the trend.';
    case 'cohesion':
      return '[tone_track] Weight on cohesion — connection and steadiness lead the aggregate.';
    case 'repair':
      return '[tone_track] Weight on repair — reciprocity signals are elevated in aggregate.';
    case 'integration':
      return '[tone_track] Weight on integration — reframing is doing more work than closure in aggregate.';
    case 'stability':
      return '[tone_track] Weight on stability — limits and pacing dominate the aggregate trend.';
    case 'strain':
      return '[tone_track] Strain flagged — smaller, legible moves are overrepresented in recent resolutions.';
    default:
      return '[tone_track] Insufficient signal yet — trend still forming from recent resolutions.';
  }
}

function describeDomain(domainKey?: string) {
  if (!domainKey) return '[domain_track] No single domain is leading the aggregate weight yet.';
  return `[domain_track] Aggregate weight is leaning on ${titleCase(domainKey)}.`;
}

function describeTrace(state: CampaignState, mode: CampaignRecord['mode']) {
  const memberCount = Object.keys(state.members || {}).length;
  if (mode !== 'solo' && memberCount > 0) {
    return `[state] ${memberCount} resolved ${memberCount === 1 ? 'member' : 'members'} contributing to pooled trace counters.`;
  }
  const history = Array.isArray(state.history) ? state.history : [];
  if (history.length > 0) {
    return `[state] History buffer non-empty — prior resolutions are feeding forward into the next daily hash.`;
  }
  return mode === 'solo'
    ? '[state] No history rows yet — first resolution will initialize the visible trace buffer.'
    : '[state] Group trace counters unlock as shared resolutions complete.';
}

function describeTradeoff(choice: ResponseChoice) {
  const direction = choice.outcomeDirection;
  if (direction === 'assert_define') return 'Tradeoff: this can sharpen friction before things settle.';
  if (direction === 'engage_advance') return 'Tradeoff: momentum can outrun the conditions if you push too quickly.';
  if (direction === 'observe_hold') return 'Tradeoff: uncertainty may linger longer while you keep the situation open.';
  if (direction === 'withdraw_protect') return 'Tradeoff: this protects capacity, but visible progress may slow.';
  if (direction === 'support_connect') return 'Tradeoff: connection may take priority over solitary momentum.';
  if (direction === 'offer_restore') return 'Tradeoff: repair can overextend you if reciprocity is not really present.';
  if (direction === 'reframe_integrate') return 'Tradeoff: interpretation can delay action if you stay in it too long.';
  if (direction === 'contain_limit') return 'Tradeoff: structure helps, but the limit can land as distance if it gets too rigid.';
  return `Tradeoff: ${sentenceCase(choice.riskProfile.replace(/_/g, ' '))}.`;
}

function describeChoice(choice: ResponseChoice) {
  const gesture = choice.symbolicGesture?.trim();
  if (gesture) return gesture;
  return `This move leans into ${titleCase(choice.outcomeDirection)}.`;
}

function mapErrorState(error: string | null): SurfaceErrorState | null {
  if (!error) return null;
  const message = error.toLowerCase();
  if (message.includes('not signed in') || message.includes('unauthorized')) {
    return {
      title: 'Access required',
      description: 'Sign in again to open this Campaign surface.',
      tone: 'warning',
    };
  }
  if (message.includes('not_found') || message.includes('campaign unavailable') || message.includes('daily generation not found')) {
    return {
      title: 'Campaign unavailable',
      description: 'This Campaign or daily artifact is not available right now.',
      tone: 'neutral',
    };
  }
  if (message.includes('transit_context_mismatch')) {
    return {
      title: 'Daily already set for this day',
      description:
        'This calendar day already has a Campaign daily. If you still see this after an update, refresh the page or try again.',
      tone: 'warning',
    };
  }
  if (
    message.includes('challenge_mismatch') ||
    message.includes('state_hash_mismatch') ||
    message.includes('stale_campaign_state') ||
    message.includes('response_conflict')
  ) {
    return {
      title: 'This daily is out of date',
      description: 'The current state no longer matches the generated daily. Regenerate the daily before continuing.',
      tone: 'warning',
    };
  }
  if (message.includes('challenge_unavailable') || message.includes('invalid_participant_roster') || message.includes('invalid_choice_mapping')) {
    return {
      title: 'Campaign cannot continue safely',
      description: 'The Campaign returned a fail-closed response. Try generating the daily again.',
      tone: 'danger',
    };
  }
  if (
    message.includes('latitude, longitude, and timezone') ||
    message.includes('location required') ||
    message.includes('location_invalid')
  ) {
    return {
      title: 'Location still needed',
      description: 'Search and select a valid place below, or ensure your saved location is set in Profile, before running this solo daily.',
      tone: 'warning',
    };
  }
  const httpMatch = /^HTTP (\d{3}):\s*(.*)$/i.exec(error);
  if (httpMatch) {
    const statusCode = Number(httpMatch[1]);
    const detail = (httpMatch[2] || '').trim();
    if (statusCode === 502) {
      return {
        title: 'Engine unavailable',
        description: detail || error,
        tone: 'danger',
      };
    }
  }
  if (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('load failed') ||
    message.includes('econnrefused')
  ) {
    return {
      title: 'Engine unavailable',
      description: error,
      tone: 'danger',
    };
  }
  return {
    title: 'Campaign issue',
    description: 'The Campaign surface could not complete that step. Try again.',
    tone: 'danger',
  };
}

function DetailsDisclosure({ children }: { children: React.ReactNode }) {
  return (
    <details className="rounded border border-white/10 bg-white/[0.03] p-4">
      <summary className="cursor-pointer text-sm text-subtext">Details</summary>
      <div className="mt-3 space-y-2 text-sm text-subtext">{children}</div>
    </details>
  );
}

function ErrorPanel({ state }: { state: SurfaceErrorState }) {
  const toneClass =
    state.tone === 'warning'
      ? 'border-amber-500/30 bg-amber-500/10'
      : state.tone === 'danger'
        ? 'border-red-500/30 bg-red-500/10'
        : 'border-white/10 bg-white/[0.03]';
  return (
    <section className={`rounded border p-4 ${toneClass}`}>
      <h2 className="text-lg font-semibold">{state.title}</h2>
      <p className="mt-2 text-sm text-subtext">{state.description}</p>
    </section>
  );
}

function ControlPanel(props: {
  requiresLocation: boolean;
  date: string;
  setDate: (value: string) => void;
  time: string;
  setTime: (value: string) => void;
  locationSearchLabel: string;
  onLocationSelect: (r: GeocodeResult) => void;
  onLocationClear: () => void;
  isLoadingDaily: boolean;
  onGenerate: () => void;
}) {
  const {
    requiresLocation,
    date,
    setDate,
    time,
    setTime,
    locationSearchLabel,
    onLocationSelect,
    onLocationClear,
    isLoadingDaily,
    onGenerate,
  } = props;

  return (
    <section className="rounded border border-white/10 bg-white/[0.02] p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h2 className="text-sm font-medium text-text">Daily controls</h2>
          <p className="text-xs text-subtext">
            Adjust the timing for this daily. Solo mode can optionally set a place override from search before generation.
          </p>
        </div>
        <button
          type="button"
          className="rounded bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-60"
          disabled={isLoadingDaily}
          onClick={onGenerate}
        >
          {isLoadingDaily ? 'Generating...' : 'Generate Daily'}
        </button>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1">
          <span className="text-sm">Date</span>
          <input className="w-full rounded border px-3 py-2 text-black" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-sm">Time</span>
          <input className="w-full rounded border px-3 py-2 text-black" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        {requiresLocation ? (
          <div className="space-y-1 lg:col-span-2">
            <span className="text-sm text-text">Place (optional override)</span>
            <p className="text-xs text-subtext">
              Search and choose a result to save today&apos;s transit place. Otherwise your saved profile location is used when available.
            </p>
            <LocationFinder
              value={locationSearchLabel}
              onSelect={onLocationSelect}
              onClear={onLocationClear}
              disabled={isLoadingDaily}
              placeholder="City, state, or country"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ContinuityPanel({ lines }: { lines: string[] }) {
  return (
    <section className="rounded border border-white/10 bg-white/[0.03] p-4">
      <h2 className="text-lg font-semibold">Campaign status</h2>
      <p className="mt-1 text-xs uppercase tracking-wide text-subtext">System read · not the daily narrative</p>
      <div className="mt-3 space-y-2 text-sm text-subtext">
        {lines.slice(0, 3).map((line, index) => (
          <p key={`${index}:${line}`}>{line}</p>
        ))}
      </div>
    </section>
  );
}

function ChallengeCard(props: {
  date: string;
  headline: string;
  supporting: string;
  setting: string;
  continuityLine?: string | null;
}) {
  const { date, headline, supporting, setting, continuityLine } = props;
  return (
    <section className="rounded border border-white/10 bg-white/[0.04] p-5">
      <p className="text-sm text-subtext">{date}</p>
      <h2 className="mt-2 text-2xl font-semibold leading-tight">{headline}</h2>
      <p className="mt-3 text-base text-subtext">{supporting}</p>
      <p className="mt-3 text-sm text-subtext/90">{setting}</p>
      {continuityLine ? <p className="mt-4 text-sm text-emerald-200">{continuityLine}</p> : null}
    </section>
  );
}

function ResponseCard(props: {
  choice: ResponseChoice;
  isResolving: boolean;
  onChoose: () => void;
}) {
  const { choice, isResolving, onChoose } = props;
  return (
    <div className="rounded border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{choice.label}</h3>
          <p className="mt-2 text-sm text-subtext">{describeChoice(choice)}</p>
        </div>
        <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-subtext">
          {titleCase(choice.posture)}
        </span>
      </div>
      <p className="mt-3 text-sm text-subtext">{describeTradeoff(choice)}</p>
      <button
        type="button"
        className="mt-4 rounded bg-white px-3 py-2 text-sm font-medium text-black disabled:opacity-60"
        disabled={isResolving}
        onClick={onChoose}
      >
        {isResolving ? 'Resolving...' : 'Choose'}
      </button>
    </div>
  );
}

function GroupRosterPanel(props: {
  roster: DailyResponse['daily']['daily']['participant_roster'];
  collection: DailyResponse['daily']['daily']['response_collection'];
  resolution: DailyResponse['daily']['resolution'];
}) {
  const { roster, collection, resolution } = props;
  const isResolved = Boolean(resolution);
  return (
    <section className="rounded border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Group state</h2>
          <p className="mt-1 text-sm text-subtext">
            Readiness: {collection.accepted_response_count} / {collection.members_total}
          </p>
        </div>
        {!isResolved ? <span className="text-xs text-subtext">Responses stay hidden until full resolution.</span> : null}
      </div>
      <div className="mt-4 space-y-2 text-sm">
        {roster.map((member) => {
          const accepted = collection.accepted_responses[member.chart_id];
          const resolvedEntry = resolution?.ordered_member_resolutions.find((entry) => entry.member_id === member.chart_id);
          const status = isResolved
            ? resolvedEntry
              ? `${resolvedEntry.response_label} (${titleCase(resolvedEntry.response_posture)})`
              : 'No visible response'
            : accepted
              ? 'Submitted'
              : 'Choosing';
          return (
            <div key={member.chart_id} className="flex items-center justify-between rounded border border-white/10 px-3 py-2">
              <span>{member.user_id}</span>
              <span className="text-subtext">{status}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function OutcomePanel(props: {
  mode: CampaignRecord['mode'];
  resolution: NonNullable<DailyResponse['daily']['resolution']>;
  continuityLine?: string | null;
}) {
  const { mode, resolution, continuityLine } = props;
  const ordered = resolution.ordered_member_resolutions;
  const sharedLine =
    mode === 'solo'
      ? 'Your choice has now been applied as the canonical outcome for this daily.'
      : `The group has resolved ${resolution.response_count} responses into one shared campaign state.`;

  return (
    <section className="rounded border border-emerald-500/30 bg-emerald-500/10 p-5">
      <h2 className="text-lg font-semibold">Outcome</h2>
      <div className="mt-3 space-y-4">
        <div>
          <h3 className="text-sm font-medium uppercase tracking-wide text-emerald-100/80">Immediate consequence</h3>
          <p className="mt-2 text-sm">{mode === 'solo' ? 'This choice now shapes the next state of the campaign.' : 'The shared challenge has now been fully resolved.'}</p>
        </div>
        {mode !== 'solo' && (
          <div>
            <h3 className="text-sm font-medium uppercase tracking-wide text-emerald-100/80">Shared consequence</h3>
            <p className="mt-2 text-sm">{sharedLine}</p>
          </div>
        )}
        {mode !== 'solo' && (
          <div>
            <h3 className="text-sm font-medium uppercase tracking-wide text-emerald-100/80">Member contributions</h3>
            <div className="mt-2 space-y-2 text-sm">
              {ordered.map((entry) => (
                <div key={`${entry.member_id}:${entry.choice_id}`} className="rounded border border-emerald-400/20 px-3 py-2">
                  {entry.user_id}: {entry.response_label} ({titleCase(entry.response_posture)})
                </div>
              ))}
            </div>
          </div>
        )}
        {mode === 'solo' && ordered[0] ? (
          <div>
            <h3 className="text-sm font-medium uppercase tracking-wide text-emerald-100/80">Immediate consequence</h3>
            <p className="mt-2 text-sm">{ordered[0].response_label} is now the committed path for this daily.</p>
          </div>
        ) : null}
        {continuityLine ? (
          <div>
            <h3 className="text-sm font-medium uppercase tracking-wide text-emerald-100/80">Continuity forward</h3>
            <p className="mt-2 text-sm">{continuityLine}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function CampaignDailyClient({ campaignId }: { campaignId: string }) {
  const [campaign, setCampaign] = useState<CampaignRecord | null>(null);
  const [daily, setDaily] = useState<DailyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingCampaign, setIsLoadingCampaign] = useState(true);
  const [isLoadingDaily, setIsLoadingDaily] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  /** Internal only — set from LocationFinder selection, never user-typed coordinates */
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [timezone, setTimezone] = useState('');
  const [locationSearchLabel, setLocationSearchLabel] = useState('');
  const [resolveResult, setResolveResult] = useState<ResolveResponse | null>(null);

  const dailyRef = useRef<DailyResponse | null>(null);
  dailyRef.current = daily;
  const lastLoadedContextKeyRef = useRef<string>('');
  const dailyAbortRef = useRef<AbortController | null>(null);
  const dailyLoadGenRef = useRef(0);

  const onLocationSelect = useCallback((r: GeocodeResult) => {
    setLocationSearchLabel(r.label);
    setLat(String(r.lat));
    setLon(String(r.lon));
    setTimezone(r.timezone);
  }, []);

  const onLocationClear = useCallback(() => {
    setLocationSearchLabel('');
    setLat('');
    setLon('');
    setTimezone('');
  }, []);

  useEffect(() => {
    setDaily(null);
    setResolveResult(null);
    lastLoadedContextKeyRef.current = '';
    dailyAbortRef.current?.abort();
  }, [campaignId]);

  useEffect(() => {
    let cancelled = false;

    async function loadCampaign() {
      setIsLoadingCampaign(true);
      setError(null);
      try {
        const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}`, {
          headers: { Accept: 'application/json' },
        });
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        if (!response.ok) {
          const detail =
            (typeof data.error === 'string' && data.error) ||
            (typeof data.message === 'string' && data.message) ||
            'Failed to load campaign';
          const errMsg = `HTTP ${response.status}: ${detail}`;
          console.warn('[campaign-bootstrap]', {
            campaignId,
            status: response.status,
            message: errMsg,
          });
          throw new Error(errMsg);
        }
        if (!cancelled) {
          setCampaign(data as CampaignRecord);
        }
      } catch (loadError) {
        if (!cancelled) {
          const msg = loadError instanceof Error ? loadError.message : String(loadError);
          console.warn('[campaign-bootstrap]', { campaignId, status: null, message: msg });
          setError(msg);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingCampaign(false);
        }
      }
    }

    void loadCampaign();
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const requiresLocation = campaign?.mode === 'solo';
  const activeState = resolveResult?.newState ?? campaign?.stateJson;
  const liveResponseCollection = resolveResult?.responseCollection ?? daily?.daily.daily.response_collection ?? null;
  const resolution = daily?.daily.resolution ?? null;
  const challenge = daily?.daily.daily.challenge ?? null;
  const readiness = resolveResult?.readiness ?? (liveResponseCollection
    ? {
        is_ready: liveResponseCollection.pending_member_chart_ids.length === 0,
        accepted_response_count: liveResponseCollection.accepted_response_count,
        members_total: liveResponseCollection.members_total,
        ready_member_chart_ids: liveResponseCollection.ready_member_chart_ids,
        pending_member_chart_ids: liveResponseCollection.pending_member_chart_ids,
      }
    : null);

  const errorState = mapErrorState(error);

  const continuityLines = useMemo(() => {
    if (!activeState || !campaign) return [];
    const toneKey = topTrackEntry(activeState.tone_track)?.[0];
    const topDomainRaw = topTrackEntry(activeState.domain_track)?.[0];
    const topDomain = topDomainRaw?.startsWith('domain:') ? topDomainRaw.split(':')[1] : topDomainRaw;
    return [describeTone(toneKey), describeDomain(topDomain), describeTrace(activeState, campaign.mode)].filter(Boolean);
  }, [activeState, campaign]);

  const challengeContinuityLine = continuityLines[1] ?? continuityLines[0] ?? null;

  const currentAcceptedResponse = useMemo(() => {
    // `anchorUserId` identifies the stored transit-context owner for the day, not the current viewer.
    // Using it here can incorrectly hide response options from other valid group members.
    return resolveResult?.acceptedResponse ?? null;
  }, [resolveResult?.acceptedResponse]);

  const groupStage = useMemo(() => {
    if (!campaign || campaign.mode === 'solo') return 'solo';
    if (resolution) return 'resolved';
    if (currentAcceptedResponse) return 'waiting';
    return 'pre';
  }, [campaign, currentAcceptedResponse, resolution]);

  const executeDailyPost = useCallback(
    async (signal: AbortSignal, clearResolveResult: boolean) => {
      if (!campaign) return;
      const gen = ++dailyLoadGenRef.current;
      const solo = campaign.mode === 'solo';
      const geoPart = solo ? `${lat}|${lon}|${timezone}` : '';
      /* Solo daily identity is day-canonical; omit clock time from dedupe key to avoid redundant refetches. */
      const contextKey = solo ? `${campaignId}|${date}|${geoPart}` : `${campaignId}|${date}|${time}|${geoPart}`;

      if (clearResolveResult) setResolveResult(null);
      setError(null);
      setIsLoadingDaily(true);
      try {
        const body: Record<string, unknown> = { date, time };
        if (solo) {
          const latitude = Number(lat);
          const longitude = Number(lon);
          const hasLocationOverride = Number.isFinite(latitude) && Number.isFinite(longitude) && timezone.trim();
          if (hasLocationOverride) {
            const label =
              locationSearchLabel.trim() ||
              `${latitude.toFixed(4)}, ${longitude.toFixed(4)} (${timezone.trim()})`;
            const location = {
              source: 'geofinder' as const,
              label,
              lat: latitude,
              lon: longitude,
              timezone: timezone.trim(),
              resolvedAt: new Date().toISOString(),
            };
            body.location = location;
            const putRes = await fetch('/api/users/me/transit-context', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(location),
              signal,
            });
            if (signal.aborted) return;
            if (!putRes.ok) {
              const errBody = await putRes.json().catch(() => ({}));
              throw new Error(
                (errBody as { error?: string; message?: string }).error ||
                  (errBody as { message?: string }).message ||
                  'Could not save your place for this daily'
              );
            }
          }
        }

        const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/daily`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(body),
          signal,
        });
        const data = await response.json().catch(() => ({}));
        if (signal.aborted) return;
        if (!response.ok) {
          throw new Error(
            (data as { code?: string; message?: string; error?: string }).code ||
              (data as { message?: string }).message ||
              (data as { error?: string }).error ||
              'Failed to generate campaign daily'
          );
        }
        if (dailyLoadGenRef.current !== gen) return;
        setDaily(data as DailyResponse);
        lastLoadedContextKeyRef.current = contextKey;
      } catch (loadError: unknown) {
        if (signal.aborted) return;
        const err = loadError as { name?: string };
        if (err && err.name === 'AbortError') return;
        if (dailyLoadGenRef.current !== gen) return;
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      } finally {
        if (dailyLoadGenRef.current === gen) {
          setIsLoadingDaily(false);
        }
      }
    },
    [campaign, campaignId, date, time, lat, lon, timezone, locationSearchLabel]
  );

  const kickoffDailyRequest = useCallback(
    (clearResolveResult: boolean) => {
      dailyAbortRef.current?.abort();
      const ac = new AbortController();
      dailyAbortRef.current = ac;
      void executeDailyPost(ac.signal, clearResolveResult);
    },
    [executeDailyPost]
  );

  useEffect(() => {
    if (!campaign || isLoadingCampaign) return;
    const solo = campaign.mode === 'solo';
    const geoPart = solo ? `${lat}|${lon}|${timezone}` : '';
    const contextKey = solo ? `${campaignId}|${date}|${geoPart}` : `${campaignId}|${date}|${time}|${geoPart}`;
    if (dailyRef.current !== null && lastLoadedContextKeyRef.current === contextKey) {
      return;
    }

    dailyAbortRef.current?.abort();
    const ac = new AbortController();
    dailyAbortRef.current = ac;
    void executeDailyPost(ac.signal, true);

    return () => {
      ac.abort();
    };
  }, [campaign, isLoadingCampaign, campaignId, date, time, campaign?.mode, lat, lon, timezone, executeDailyPost]);

  async function resolveChoice(choiceId: string) {
    if (!daily) return;
    setIsResolving(true);
    setError(null);
    try {
      const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/daily/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          calendarDate: daily.calendarDate,
          engineVersion: daily.engineVersion,
          choiceId,
          challengeFingerprint: daily.daily.daily.challenge_fingerprint,
          stateHashBefore: daily.daily.daily.state_hash_before,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.code || data?.message || data?.error || 'Failed to resolve campaign daily');
      }
      setResolveResult(data as ResolveResponse);
      setDaily((current) =>
        current
          ? {
              ...current,
              daily: {
                ...current.daily,
                resolution: (data as ResolveResponse).resolution,
              },
            }
          : current
      );
      setCampaign((current) =>
        current
          ? {
              ...current,
              stateJson: (data as ResolveResponse).newState,
              stateHash: (data as ResolveResponse).stateHash,
              stateVersion: (data as ResolveResponse).stateVersion,
            }
          : current
      );
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : String(resolveError));
    } finally {
      setIsResolving(false);
    }
  }

  if (isLoadingCampaign) {
    return <main className="min-h-screen flex items-center justify-center">Loading campaign...</main>;
  }

  if (error && !campaign) {
    const bootstrapError = mapErrorState(error);
    if (bootstrapError) {
      return (
        <main className="min-h-screen bg-bg px-6 py-8 text-text flex items-center justify-center">
          <div className="w-full max-w-lg">
            <ErrorPanel state={bootstrapError} />
          </div>
        </main>
      );
    }
  }

  if (!campaign) {
    return <main className="min-h-screen flex items-center justify-center">Campaign unavailable.</main>;
  }

  const responseChoices = challenge?.choices.slice(0, 5) ?? [];

  return (
    <main className="min-h-screen bg-bg px-6 py-8 text-text">
      <div className="mx-auto max-w-5xl space-y-6">
        <p className="text-xs text-subtext rounded-lg border border-border bg-bgElev px-3 py-2">
          Group coordination uses structured Signals in Community, not chat.{' '}
          <Link href="/community?tab=connections" className="text-emerald hover:underline">
            Open Community → Connections
          </Link>
          .
        </p>
        <section className="space-y-2">
          <p className="text-sm text-subtext">{titleCase(campaign.mode)} Campaign</p>
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Campaign</h1>
              <p className="text-sm text-subtext">Chapter {(activeState?.chapter ?? 1)}{groupStage === 'waiting' ? ' · Waiting on the group' : groupStage === 'resolved' ? ' · Resolution complete' : ''}</p>
            </div>
            {daily ? <p className="text-sm text-subtext">{daily.fromCache ? 'Loaded from cached daily artifact.' : 'Fresh daily artifact generated.'}</p> : null}
          </div>
        </section>

        <ControlPanel
          requiresLocation={Boolean(requiresLocation)}
          date={date}
          setDate={setDate}
          time={time}
          setTime={setTime}
          locationSearchLabel={locationSearchLabel}
          onLocationSelect={onLocationSelect}
          onLocationClear={onLocationClear}
          isLoadingDaily={isLoadingDaily}
          onGenerate={() => kickoffDailyRequest(true)}
        />

        {errorState ? <ErrorPanel state={errorState} /> : null}

        {daily && challenge ? (
          <>
            <ChallengeCard
              date={daily.calendarDate}
              headline={challenge.theme}
              supporting={challenge.obstacle}
              setting={challenge.setting}
              continuityLine={challengeContinuityLine}
            />

            {continuityLines.length > 0 ? <ContinuityPanel lines={continuityLines} /> : null}

            {campaign.mode !== 'solo' && liveResponseCollection ? (
              <GroupRosterPanel
                roster={daily.daily.daily.participant_roster}
                collection={liveResponseCollection}
                resolution={resolution}
              />
            ) : null}

            {campaign.mode === 'solo' || groupStage === 'pre' ? (
              <section className="space-y-3">
                <div>
                  <h2 className="text-lg font-semibold">Responses</h2>
                  <p className="mt-1 text-sm text-subtext">
                    Choose the move that best matches how you want to meet this challenge.
                    {campaign.mode !== 'solo' && readiness
                      ? ` Group readiness: ${readiness.accepted_response_count} / ${readiness.members_total}.`
                      : null}
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {responseChoices.map((choice) => (
                    <ResponseCard
                      key={choice.id}
                      choice={choice}
                      isResolving={isResolving}
                      onChoose={() => void resolveChoice(choice.id)}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {campaign.mode !== 'solo' && groupStage === 'waiting' && currentAcceptedResponse ? (
              <section className="rounded border border-white/10 bg-white/[0.03] p-4">
                <h2 className="text-lg font-semibold">Waiting for group resolution</h2>
                <p className="mt-2 text-sm text-subtext">
                  Your response is locked. Teammate choices stay hidden until everyone has submitted.
                </p>
                <div className="mt-4 rounded border border-white/10 px-3 py-3 text-sm">
                  <p className="font-medium">{currentAcceptedResponse.response_label}</p>
                  <p className="mt-1 text-subtext">{titleCase(currentAcceptedResponse.response_posture)}</p>
                </div>
              </section>
            ) : null}

            {resolution ? (
              <OutcomePanel
                mode={campaign.mode}
                resolution={resolution}
                continuityLine={continuityLines[1] ?? continuityLines[2] ?? null}
              />
            ) : null}

            <DetailsDisclosure>
              <div className="space-y-3">
                <div>
                  <p className="font-medium text-text">Campaign state</p>
                  <p>State version: {campaign.stateVersion}</p>
                  <p>State hash: {campaign.stateHash}</p>
                </div>
                <div>
                  <p className="font-medium text-text">Daily artifact</p>
                  <p>Challenge fingerprint: {daily.daily.daily.challenge_fingerprint}</p>
                  <p>State hash before: {daily.daily.daily.state_hash_before}</p>
                  <p>Transit context fingerprint: {daily.transitContextFingerprint}</p>
                </div>
                <div>
                  <p className="font-medium text-text">Challenge taxonomy</p>
                  <p>Archetype category: {daily.daily.daily.challenge_archetype.archetype_category}</p>
                  <p>Primary domain: {daily.daily.daily.challenge_archetype.primary_domain_id}</p>
                  <p>Interaction type: {daily.daily.daily.challenge_archetype.interaction_type}</p>
                  <p>Intensity band: {daily.daily.daily.challenge_archetype.primary_intensity_band}</p>
                  <p>
                    Pressure: {daily.daily.daily.challenge.primaryPressure.transitBody} {'->'} {daily.daily.daily.challenge.primaryPressure.natalBody} / house{' '}
                    {daily.daily.daily.challenge.primaryPressure.natalHouse} / {daily.daily.daily.challenge.primaryPressure.aspectType}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-text">Character details</p>
                  <p>Class: {daily.daily.daily.character_sheet.class_slug}</p>
                  <p>Subclass: {daily.daily.daily.character_sheet.subclass_slug}</p>
                  <p>Rising: {daily.daily.daily.character_sheet.rising_modifier_slug}</p>
                </div>
                <div>
                  <p className="font-medium text-text">Choices</p>
                  <div className="space-y-1">
                    {responseChoices.map((choice) => (
                      <p key={choice.id}>
                        {choice.label}: posture={choice.posture}, modality={choice.modality}, risk={choice.riskProfile}, pattern={choice.patternTag}
                      </p>
                    ))}
                  </div>
                </div>
                {resolution ? (
                  <div>
                    <p className="font-medium text-text">Resolution details</p>
                    <p>Resolved at: {resolution.resolved_at}</p>
                    <p>State hash after: {resolution.state_hash_after}</p>
                    <div className="mt-2 space-y-1">
                      {resolution.ordered_member_resolutions.map((entry) => (
                        <p key={`${entry.member_id}:${entry.choice_id}`}>
                          {entry.user_id} ({entry.member_id}) {'->'} {entry.outcome_patch_id}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </DetailsDisclosure>
          </>
        ) : isLoadingDaily ? (
          <section className="rounded border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-lg font-semibold">Today&apos;s challenge</h2>
            <p className="mt-2 text-sm text-subtext">Loading daily artifact for the selected date and time…</p>
          </section>
        ) : (
          <section className="rounded border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-lg font-semibold">Today&apos;s challenge</h2>
            <p className="mt-2 text-sm text-subtext">
              No daily is available yet for this date and time. Adjust controls and use Generate Daily, or confirm your place and saved profile location for solo mode.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
