'use client';

import React, { useEffect, useMemo, useState } from 'react';

type CampaignRecord = {
  campaignId: string;
  mode: 'solo' | 'group' | 'auto';
  stateJson: {
    chapter?: number;
    flags?: string[];
    domain_track?: Record<string, number>;
  };
  stateHash: string;
  stateVersion: number;
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
        choices: Array<{
          id: string;
          label: string;
          symbolicGesture: string;
          patternTag: string;
          posture: string;
          modality: string;
          riskProfile: string;
          outcomeDirection: string;
        }>;
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
        accepted_responses: Record<string, {
          member_id: string;
          user_id: string;
          choice_id: string;
          response_path_id: string;
          response_pattern_tag: string;
          response_posture: string;
          response_label: string;
          accepted_at: string | null;
        }>;
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
  newState: {
    chapter?: number;
    flags?: string[];
    domain_track?: Record<string, number>;
  };
  stateHash: string;
  stateVersion: number;
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
  const stateSummary = useMemo(() => {
    const state = resolveResult?.newState ?? campaign?.stateJson;
    if (!state) return [];
    return Object.entries(state.domain_track || {})
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5);
  }, [campaign, resolveResult]);
  const liveResponseCollection = resolveResult?.responseCollection ?? daily?.daily.daily.response_collection;

  async function fetchDaily() {
    setIsLoadingDaily(true);
    setError(null);
    setResolveResult(null);
    try {
      const body: Record<string, unknown> = { date, time };
      if (requiresLocation) {
        const latitude = Number(lat);
        const longitude = Number(lon);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !timezone.trim()) {
          throw new Error('Latitude, longitude, and timezone are required for solo daily generation');
        }
        const location = { lat: latitude, lon: longitude, timezone: timezone.trim() };
        body.location = location;
        await fetch('/api/users/me/transit-context', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(location),
        });
      }

      const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/daily`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || data?.error || 'Failed to generate campaign daily');
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
        throw new Error(data?.message || data?.error || 'Failed to resolve campaign daily');
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

  return (
    <main className="min-h-screen bg-bg text-text px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="space-y-2">
          <h1 className="text-2xl font-semibold">Campaign</h1>
          <p className="text-sm text-subtext">
            Mode: {campaign.mode} | State version: {campaign.stateVersion} | State hash: {campaign.stateHash}
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
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
                <input className="w-full rounded border px-3 py-2 text-black" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="40.7128" />
              </label>
              <label className="space-y-1">
                <span className="text-sm">Longitude</span>
                <input className="w-full rounded border px-3 py-2 text-black" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="-74.0060" />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-sm">Timezone</span>
                <input className="w-full rounded border px-3 py-2 text-black" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
              </label>
            </>
          )}
        </section>

        <div>
          <button
            type="button"
            className="rounded bg-white px-4 py-2 text-black disabled:opacity-60"
            disabled={isLoadingDaily}
            onClick={() => void fetchDaily()}
          >
            {isLoadingDaily ? 'Generating...' : 'Generate Daily'}
          </button>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded border border-white/10 p-4">
            <h2 className="text-lg font-semibold">CampaignState</h2>
            <p className="mt-2 text-sm">Chapter: {(resolveResult?.newState.chapter ?? campaign.stateJson.chapter) || 1}</p>
            <p className="mt-2 text-sm">Flags: {((resolveResult?.newState.flags ?? campaign.stateJson.flags) || []).join(', ') || 'none'}</p>
            <div className="mt-4 space-y-1 text-sm">
              {stateSummary.map(([domain, value]) => (
                <div key={domain}>
                  {domain}: {value.toFixed(2)}
                </div>
              ))}
            </div>
          </div>

          {daily && (
            <div className="rounded border border-white/10 p-4">
              <h2 className="text-lg font-semibold">Character Sheet</h2>
              <p className="mt-2 text-sm">Class: {daily.daily.daily.character_sheet.class_slug}</p>
              <p className="text-sm">Subclass: {daily.daily.daily.character_sheet.subclass_slug}</p>
              <p className="text-sm">Rising: {daily.daily.daily.character_sheet.rising_modifier_slug}</p>
              <div className="mt-4 space-y-1 text-sm">
                {daily.daily.daily.character_sheet.top_domains.map((domain) => (
                  <div key={domain.domain}>
                    {domain.domain}: {domain.score.toFixed(2)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {daily && (
          <section className="rounded border border-white/10 p-4 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Challenge</h2>
              <p className="mt-2 text-sm text-subtext">
                {daily.calendarDate} | {daily.daily.daily.challenge_archetype.archetype_category} |{' '}
                {daily.daily.daily.challenge_archetype.primary_transit_body} {'->'} {daily.daily.daily.challenge_archetype.primary_natal_body} |{' '}
                {daily.daily.daily.challenge_archetype.primary_domain_id} |{' '}
                {daily.daily.daily.challenge_archetype.interaction_type} |{' '}
                {daily.daily.daily.challenge_archetype.primary_intensity_band}
              </p>
            </div>

            <div className="space-y-2">
              <p><strong>Theme:</strong> {daily.daily.daily.challenge.theme}</p>
              <p><strong>Setting:</strong> {daily.daily.daily.challenge.setting}</p>
              <p><strong>Obstacle:</strong> {daily.daily.daily.challenge.obstacle}</p>
              <p className="text-sm text-subtext">
                Primary pressure: {daily.daily.daily.challenge.primaryPressure.transitBody} {'->'} {daily.daily.daily.challenge.primaryPressure.natalBody} /{' '}
                house {daily.daily.daily.challenge.primaryPressure.natalHouse} / {daily.daily.daily.challenge.primaryPressure.aspectType} /{' '}
                {daily.daily.daily.challenge.primaryPressure.pressureFamily} / {daily.daily.daily.challenge.primaryPressure.domain}
              </p>
            </div>

            {campaign.mode !== 'solo' && liveResponseCollection && (
              <div className="rounded border border-white/10 p-3 text-sm">
                <p>
                  Group readiness: {liveResponseCollection.accepted_response_count} / {liveResponseCollection.members_total}
                </p>
                <div className="mt-2 space-y-1">
                  {daily.daily.daily.participant_roster.map((member) => {
                    const accepted = liveResponseCollection.accepted_responses[member.chart_id];
                    return (
                      <div key={member.chart_id}>
                        {member.user_id} ({member.chart_id}):{' '}
                        {accepted ? `${accepted.response_label} [${accepted.response_posture}]` : 'waiting'}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="font-medium">Choices</h3>
              {daily.daily.daily.challenge.choices.map((choice) => {
                const isSelected = Boolean(
                  daily.daily.resolution?.ordered_member_resolutions?.some((resolution) => resolution.choice_id === choice.id)
                );
                return (
                  <div key={choice.id} className="rounded border border-white/10 p-3">
                    <p className="font-medium">{choice.label}</p>
                    <p className="text-sm text-subtext">{choice.symbolicGesture}</p>
                    <p className="text-xs text-subtext mt-1">
                      posture: {choice.posture} | modality: {choice.modality} | risk: {choice.riskProfile}
                    </p>
                    <button
                      type="button"
                      className="mt-3 rounded bg-white px-3 py-2 text-black disabled:opacity-60"
                      disabled={Boolean(daily.daily.resolution) || isResolving}
                      onClick={() => void resolveChoice(choice.id)}
                    >
                      {isSelected ? 'Selected' : isResolving ? 'Resolving...' : 'Choose'}
                    </button>
                  </div>
                );
              })}
            </div>

            {daily.daily.resolution && (
              <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-4">
                <h3 className="font-medium">Resolution</h3>
                <p className="text-sm mt-2">Responses resolved: {daily.daily.resolution.response_count}</p>
                <p className="text-sm">State hash after: {daily.daily.resolution.state_hash_after}</p>
                <div className="mt-3 space-y-1 text-sm">
                  {daily.daily.resolution.ordered_member_resolutions.map((entry) => (
                    <div key={`${entry.member_id}:${entry.choice_id}`}>
                      {entry.user_id} ({entry.member_id}): {entry.response_label} [{entry.response_posture}] {'->'} {entry.outcome_patch_id}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
