'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/shared/Card';
import { Button } from '@/components/shared/Button';
import { useCommunitySettings } from '@/core/social/community-posts-hooks';
import { isFeatureEnabled } from '@/config/flags';

export function CommunitySettings() {
  const enabled = isFeatureEnabled('ENABLE_COMMUNITY_POSTS');
  const { settings, loading, saving, error, save } = useCommunitySettings();
  const [bio, setBio] = useState('');
  const [publicVisibility, setPublicVisibility] = useState(true);
  const [keywordsText, setKeywordsText] = useState('');
  const [saved, setSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!settings || hydrated) return;
    setBio(settings.bio);
    setPublicVisibility(settings.publicVisibility);
    setKeywordsText(settings.keywords.join(', '));
    setHydrated(true);
  }, [settings, hydrated]);

  if (loading) {
    return <p className="text-sm text-text-secondary">Loading settings…</p>;
  }

  if (!enabled) {
    return (
      <Card elevation="resting" className="text-sm text-text-secondary">
        Community posts are not enabled for your account yet.
      </Card>
    );
  }

  const onSave = async () => {
    setSaved(false);
    const keywords = keywordsText
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    await save({ bio, publicVisibility, keywords });
    setSaved(true);
  };

  return (
    <Card elevation="resting" className="space-y-4 max-w-xl">
      <h1 className="text-h2 font-serif text-text-primary">Community settings</h1>
      <label className="block space-y-1">
        <span className="text-sm text-text-secondary">Bio</span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm"
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-text-primary">
        <input
          type="checkbox"
          checked={publicVisibility}
          onChange={(e) => setPublicVisibility(e.target.checked)}
        />
        Public profile visible in community
      </label>
      <label className="block space-y-1">
        <span className="text-sm text-text-secondary">Keywords (comma-separated)</span>
        <input
          type="text"
          value={keywordsText}
          onChange={(e) => setKeywordsText(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm"
        />
      </label>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      {saved ? <p className="text-xs text-accent">Saved.</p> : null}
      <Button type="button" size="sm" disabled={saving} onClick={() => void onSave()}>
        {saving ? 'Saving…' : 'Save settings'}
      </Button>
    </Card>
  );
}
