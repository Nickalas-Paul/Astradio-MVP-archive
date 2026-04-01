'use client';

import React, { useEffect, useMemo, useState } from 'react';

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
  return new Date().toISOString().slice(0, 10);
}

function initialTime() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function initialTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
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
      return 'The campaign climate is leaning toward clearer lines and sharper definition.';
    case 'momentum':
      return 'The campaign climate is leaning toward motion, follow-through, and forward pressure.';
    case 'ambiguity':
      return 'The campaign climate is holding uncertainty open instead of forcing a quick answer.';
    case 'containment':
      return 'The campaign climate is prioritizing capacity, boundaries, and measured exposure.';
    case 'cohesion':
      return 'The campaign climate is leaning toward connection, steadiness, and trust.';
    case 'repair':
      return 'The campaign climate is leaning toward repair and restoring what can still hold.';
    case 'integration':
      return 'The campaign climate is leaning toward reframing and making mixed signals cohere.';
    case 'stability':
      return 'The campaign climate is leaning toward limits, pacing, and preserving structure.';
    case 'strain':
      return 'The campaign climate is carrying strain, so smaller and clearer moves matter more.';
    default:
      return 'The campaign climate is still gathering shape from recent choices.';
  }
}

function describeDomain(domainKey?: string) {
  if (!domainKey) return 'Pressure is still distributing across the campaign rather than concentrating in one area.';
  return `Carry-forward pressure is concentrating around ${titleCase(domainKey)}.`;
}

function describeTrace(state: CampaignState, mode: CampaignRecord['mode']) {
  const memberCount = Object.keys(state.members || {}).length;
  if (mode !== 'solo' && memberCount > 0) {
    return `Member traces are accumulating across ${memberCount} resolved ${memberCount === 1 ? 'member' : 'members'}.`;
  }
  const history = Array.isArray(state.history) ? state.history : [];
  if (history.length > 0) {
    return 'Your recent trace is carrying forward into the next challenge.';
  }
  return mode === 'solo'
    ? 'Your next decision will establish the first visible trace for this campaign.'
    : 'Group traces will become clearer as more shared resolutions complete.';
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
  if (message.includes('not signed in')) {
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
  if (message.includes('latitude, longitude, and timezone')) {
    return {
      title: 'Location still needed',
      description: 'Add a saved location below before generating this solo daily.',
      tone: 'warning',
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
  lat: string;
  setLat: (value: string) => void;
  lon: string;
  setLon: (value: string) => void;
  timezone: string;
  setTimezone: (value: string) => void;
  isLoadingDaily: boolean;
  onGenerate: () => void;
}) {
  const {
    requiresLocation,
    date,
    setDate,
    time,
    setTime,
    lat,
    setLat,
    lon,
    setLon,
    timezone,
    setTimezone,
    isLoadingDaily,
    onGenerate,
  } = props;

  return (
    <section className="rounded border border-white/10 bg-white/[0.02] p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h2 className="text-sm font-medium text-text">Daily controls</h2>
          <p className="text-xs text-subtext">
            Adjust the timing for this daily. Solo mode can optionally save a location override before generation.
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
      <div className="mt-4 grid gap-4 md:grid-cols-4">
        <label className="space-y-1">
          <span className="text-sm">Date</span>
          <input className="w-full rounded border px-3 py-2 text-black" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-sm">Time</span>
          <input className="w-full rounded border px-3 py-2 text-black" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        {requiresLocation && (
          <>
            <label className="space-y-1">
              <span className="text-sm">Latitude</span>
              <input className="w-full rounded border px-3 py-2 text-black" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="optional" />
            </label>
            <label className="space-y-1">
              <span className="text-sm">Longitude</span>
              <input className="w-full rounded border px-3 py-2 text-black" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="optional" />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-sm">Timezone</span>
              <input className="w-full rounded border px-3 py-2 text-black" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
            </label>
          </>
        )}
      </div>
    </section>
  );
}

function ContinuityPanel({ lines }: { lines: string[] }) {
  return (
    <section className="rounded border border-white/10 bg-white/[0.03] p-4">
      <h2 className="text-lg font-semibold">Continuity</h2>
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
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [timezone, setTimezone] = useState(initialTimezone);
  const [resolveResult, setResolveResult] = useState<ResolveResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCampaign() {
      setIsLoadingCampaign(true);
      setError(null);
      try {
        const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}`, {
          headers: { Accept: 'application/json' },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.error || 'Failed to load campaign');
        }
        if (!cancelled) {
          setCampaign(data as CampaignRecord);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
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
    if (!liveResponseCollection) return resolveResult?.acceptedResponse ?? null;
    if (resolveResult?.acceptedResponse) return resolveResult.acceptedResponse;
    const acceptedResponses = Object.values(liveResponseCollection.accepted_responses || {});
    if (!daily?.anchorUserId) return null;
    return acceptedResponses.find((entry) => entry.user_id === daily.anchorUserId) ?? null;
  }, [daily?.anchorUserId, liveResponseCollection, resolveResult?.acceptedResponse]);

  const groupStage = useMemo(() => {
    if (!campaign || campaign.mode === 'solo') return 'solo';
    if (resolution) return 'resolved';
    if (currentAcceptedResponse) return 'waiting';
    return 'pre';
  }, [campaign, currentAcceptedResponse, resolution]);

  async function fetchDaily() {
    setIsLoadingDaily(true);
    setError(null);
    setResolveResult(null);
    try {
      const body: Record<string, unknown> = { date, time };
      if (requiresLocation) {
        const latitude = Number(lat);
        const longitude = Number(lon);
        const hasLocationOverride = Number.isFinite(latitude) && Number.isFinite(longitude) && timezone.trim();
        if (hasLocationOverride) {
          const location = { lat: latitude, lon: longitude, timezone: timezone.trim() };
          body.location = location;
          await fetch('/api/users/me/transit-context', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(location),
          });
        }
      }

      const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/daily`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.code || data?.message || data?.error || 'Failed to generate campaign daily');
      }
      setDaily(data as DailyResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setIsLoadingDaily(false);
    }
  }

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

  if (!campaign) {
    return <main className="min-h-screen flex items-center justify-center">Campaign unavailable.</main>;
  }

  const responseChoices = challenge?.choices.slice(0, 5) ?? [];

  return (
    <main className="min-h-screen bg-bg px-6 py-8 text-text">
      <div className="mx-auto max-w-5xl space-y-6">
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
          lat={lat}
          setLat={setLat}
          lon={lon}
          setLon={setLon}
          timezone={timezone}
          setTimezone={setTimezone}
          isLoadingDaily={isLoadingDaily}
          onGenerate={() => void fetchDaily()}
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
        ) : (
          <section className="rounded border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-lg font-semibold">Today&apos;s challenge</h2>
            <p className="mt-2 text-sm text-subtext">
              Generate the daily artifact to bring the challenge, continuity, and response options into view.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
