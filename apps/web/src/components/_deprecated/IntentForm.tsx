'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  RELATIONAL_INTENT_OPTIONS,
  SCOPE_OPTIONS,
  toBackendScope,
  type RelationalIntent,
  type ScopeType,
} from '@/lib/compat-intent';

interface IntentFormProps {
  defaultIntent?: RelationalIntent;
  defaultScope?: ScopeType;
  groupId?: string | null;
  seekerChartId?: string | null;
}

export function IntentForm({
  defaultIntent = 'friend',
  defaultScope = 'my_groups',
  groupId = null,
  seekerChartId = null,
}: IntentFormProps) {
  const router = useRouter();
  const [intent, setIntent] = useState<RelationalIntent>(defaultIntent);
  const [scope, setScope] = useState<ScopeType>(groupId ? 'this_group' : defaultScope);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const backendScope = toBackendScope(scope);
      const body: Record<string, unknown> = {
        intent,
        limit: 20,
        scope: backendScope,
      };
      if (seekerChartId) body.seekerChartId = seekerChartId;
      if (backendScope === 'group' && groupId) body.groupId = groupId;

      const r = await fetch('/api/compatibility/intent', {
        credentials: 'same-origin',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d?.error || `Request failed ${r.status}`);
      }
      const data = await r.json();
      if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('compat_intent_results', JSON.stringify(data));
      }

      const params = new URLSearchParams();
      params.set('tab', 'discovery');
      params.set('view', 'clusters');
      params.set('intent', intent);
      params.set('scope', scope);
      if (groupId) params.set('groupId', groupId);
      if (keyword.trim()) params.set('keyword', keyword.trim());
      router.push(`/community?${params.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate clusters');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-2xl">
      <div>
        <label className="block text-sm font-medium text-text mb-2">Intent (required)</label>
        <div className="flex flex-wrap gap-2">
          {RELATIONAL_INTENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setIntent(opt.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                intent === opt.value ? 'bg-emerald text-bg' : 'bg-surface-2 text-subtext hover:bg-surface-3'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-text mb-2">Scope (required)</label>
        <div className="flex flex-wrap gap-2">
          {SCOPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setScope(opt.value as ScopeType)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                scope === opt.value ? 'bg-emerald text-bg' : 'bg-surface-2 text-subtext hover:bg-surface-3'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {scope === 'this_group' && !groupId && (
          <p className="text-xs text-subtext mt-1">Select &quot;This group&quot; when launched from a group page.</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-text mb-2">
          Filter by shared context (group, tag, interest)
        </label>
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Optional"
          className="input w-full max-w-md"
        />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="px-6 py-3 rounded-lg bg-emerald text-bg font-medium disabled:opacity-50"
      >
        {loading ? 'Generating clusters…' : 'Generate clusters'}
      </button>
    </form>
  );
}
