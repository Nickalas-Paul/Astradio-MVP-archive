'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/shared/Button';
import { Card } from '@/components/shared/Card';
import { InputField } from '@/components/shared/Input';
import type { ProfilePrimaryChart, ProfileUser } from '@/core/social/hooks';
import { useProfileChart } from '@/core/social/hooks';
import { buildChartPlacementOptions } from '@/lib/profile-chart-placements';

const BIO_MAX = 250;
const LOOKING_FOR_MAX = 250;
const DISPLAY_NAME_MAX = 50;
const HIGHLIGHTS_MAX = 3;

export interface ProfileHeaderCardProps {
  user: ProfileUser;
  primaryChart: ProfilePrimaryChart | null;
  onProfileRefresh: () => void | Promise<void>;
}

function formatBirthData(chart: ProfilePrimaryChart | null): string | undefined {
  if (!chart?.date) return undefined;
  const time = chart.time?.slice(0, 5) || chart.time;
  return time ? `${chart.date} · ${time}` : chart.date;
}

export function ProfileHeaderCard({ user, primaryChart, onProfileRefresh }: ProfileHeaderCardProps) {
  const chartId = primaryChart?.id ?? null;
  const { data: chartData, loading: chartLoading } = useProfileChart(chartId);

  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [bio, setBio] = useState(user.bio ?? '');
  const [lookingFor, setLookingFor] = useState(user.lookingFor ?? '');
  const [selectedHighlights, setSelectedHighlights] = useState<string[]>(user.chartHighlights ?? []);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const birthData = formatBirthData(primaryChart);
  const initial = (user.displayName || '?').charAt(0).toUpperCase();
  const previewHref = `/profile/${encodeURIComponent(user.handle?.trim() || user.id)}`;

  const placementOptions = useMemo(() => {
    if (!chartData?.snapshot) return [];
    return buildChartPlacementOptions(chartData.snapshot);
  }, [chartData?.snapshot]);

  const resetFormFromUser = useCallback(() => {
    setDisplayName(user.displayName || '');
    setBio(user.bio ?? '');
    setLookingFor(user.lookingFor ?? '');
    setSelectedHighlights(user.chartHighlights ?? []);
    setSaveError(null);
  }, [user]);

  const openEdit = () => {
    resetFormFromUser();
    setEditing(true);
    setSaveSuccess(false);
  };

  const cancelEdit = () => {
    resetFormFromUser();
    setEditing(false);
  };

  useEffect(() => {
    if (!saveSuccess) return;
    const t = window.setTimeout(() => setSaveSuccess(false), 2000);
    return () => window.clearTimeout(t);
  }, [saveSuccess]);

  const toggleHighlight = (label: string) => {
    setSelectedHighlights((prev) => {
      const key = label.trim().toLowerCase();
      const has = prev.some((h) => h.trim().toLowerCase() === key);
      if (has) return prev.filter((h) => h.trim().toLowerCase() !== key);
      if (prev.length >= HIGHLIGHTS_MAX) return prev;
      return [...prev, label];
    });
  };

  const handleSave = async () => {
    const trimmedName = displayName.trim();
    if (!trimmedName || trimmedName.length > DISPLAY_NAME_MAX) {
      setSaveError(`Display name must be 1–${DISPLAY_NAME_MAX} characters.`);
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const r = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          displayName: trimmedName,
          bio: bio.trim() || null,
          lookingFor: lookingFor.trim() || null,
          chartHighlights: selectedHighlights.length > 0 ? selectedHighlights : null,
        }),
      });
      const data = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setSaveError(typeof data.error === 'string' ? data.error : 'Could not save profile.');
        return;
      }
      await onProfileRefresh();
      setEditing(false);
      setSaveSuccess(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card elevation="resting" padding="p-5" className="space-y-4">
      {!editing ? (
        <>
          <div className="flex flex-wrap items-start gap-4">
            <div className="w-20 h-20 rounded-full bg-surface-0 border border-border flex items-center justify-center overflow-hidden shrink-0">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="font-serif text-h3 font-semibold text-text-primary">{initial}</span>
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <h2 className="font-serif text-h2 font-semibold text-text-primary">{user.displayName}</h2>
              {birthData ? (
                <p className="text-body-sm text-text-secondary font-sans">{birthData}</p>
              ) : null}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto min-h-[44px]"
              onClick={openEdit}
            >
              Edit profile
            </Button>
          </div>

          {user.bio ? (
            <div className="border-t border-border pt-4">
              <h3 className="text-caption font-medium uppercase tracking-wide text-text-secondary mb-2 font-sans">
                About
              </h3>
              <p className="text-body text-text-secondary leading-relaxed whitespace-pre-wrap font-sans">
                {user.bio}
              </p>
            </div>
          ) : null}

          {user.lookingFor ? (
            <div className={user.bio ? 'pt-2' : 'border-t border-border pt-4'}>
              <h3 className="text-caption font-medium uppercase tracking-wide text-text-secondary mb-2 font-sans">
                Looking for
              </h3>
              <p className="text-body-sm text-text-secondary font-sans">{user.lookingFor}</p>
            </div>
          ) : null}

          {user.chartHighlights && user.chartHighlights.length > 0 ? (
            <div className="border-t border-border pt-4">
              <h3 className="text-caption font-medium uppercase tracking-wide text-text-secondary mb-2 font-sans">
                Chart highlights
              </h3>
              <ul className="flex flex-wrap gap-2">
                {user.chartHighlights.map((h) => (
                  <li
                    key={h}
                    className="text-caption px-3 py-1.5 rounded-full border border-accent/40 bg-accent/10 text-accent-light font-sans"
                  >
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : (
        <div className="space-y-6">
          <h2 className="font-serif text-h3 font-semibold text-text-primary">Edit profile</h2>

          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="w-20 h-20 rounded-full bg-surface-0 border border-border flex items-center justify-center overflow-hidden shrink-0 mx-auto sm:mx-0">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="font-serif text-h3 font-semibold text-text-primary">{initial}</span>
              )}
            </div>
            <div className="flex-1 flex flex-col items-center sm:items-start gap-2 w-full">
              <Button type="button" variant="ghost" size="sm" disabled className="opacity-60 cursor-not-allowed">
                Upload photo (coming soon)
              </Button>
            </div>
          </div>

          <InputField
            label="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={DISPLAY_NAME_MAX}
            required
            className="min-h-[44px]"
          />

          <div className="flex flex-col gap-1 w-full">
            <label htmlFor="profile-bio" className="text-body-sm font-medium text-text-primary font-sans">
              About you
            </label>
            <textarea
              id="profile-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
              maxLength={BIO_MAX}
              rows={4}
              placeholder="What are you here for? What kind of connections are you looking for?"
              className="input min-h-[44px] resize-y font-sans"
            />
            <p className="text-caption text-text-muted font-sans">
              {bio.length} / {BIO_MAX}
            </p>
          </div>

          <InputField
            label="Looking for"
            value={lookingFor}
            onChange={(e) => setLookingFor(e.target.value.slice(0, LOOKING_FOR_MAX))}
            maxLength={LOOKING_FOR_MAX}
            placeholder="Creative collaborators, deep conversations, music lovers..."
            className="min-h-[44px]"
          />

          <div className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-body-sm font-medium text-text-primary font-sans">
                Highlight up to 3 placements
              </p>
              <p className="text-caption text-text-muted font-sans">
                ({selectedHighlights.length}/{HIGHLIGHTS_MAX} selected)
              </p>
            </div>

            {chartLoading && !chartData ? (
              <p className="text-body-sm text-text-secondary font-sans">Loading chart placements…</p>
            ) : placementOptions.length === 0 ? (
              <p className="text-body-sm text-text-secondary font-sans">
                Link a birth chart to choose placement highlights.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {placementOptions.map((label) => {
                  const selected = selectedHighlights.some(
                    (h) => h.trim().toLowerCase() === label.trim().toLowerCase()
                  );
                  const atMax = selectedHighlights.length >= HIGHLIGHTS_MAX && !selected;
                  return (
                    <li key={label}>
                      <button
                        type="button"
                        disabled={atMax}
                        onClick={() => toggleHighlight(label)}
                        className={`text-caption font-sans px-3 py-2 min-h-[44px] rounded-full border transition-colors duration-fast ${
                          selected
                            ? 'border-accent bg-accent/10 text-accent-light'
                            : 'border-border bg-surface-0 text-text-secondary hover:border-accent/50 disabled:opacity-50'
                        }`}
                      >
                        {label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {saveError ? (
            <p className="text-body-sm text-red-500 font-sans" role="alert">
              {saveError}
            </p>
          ) : null}

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="w-full sm:w-auto min-h-[44px]"
              disabled={saving}
              loading={saving}
              onClick={() => void handleSave()}
            >
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full sm:w-auto min-h-[44px]"
              disabled={saving}
              onClick={cancelEdit}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {saveSuccess && !editing ? (
        <p className="text-body-sm text-accent-light font-sans" role="status">
          Profile updated
        </p>
      ) : null}

      <p className="border-t border-border pt-4">
        <Link
          href={previewHref}
          className="text-body-sm text-accent-light hover:text-accent font-sans inline-flex items-center min-h-[44px]"
        >
          Preview how others see your profile →
        </Link>
      </p>
    </Card>
  );
}
