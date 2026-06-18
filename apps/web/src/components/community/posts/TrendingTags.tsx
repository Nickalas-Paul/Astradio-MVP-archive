'use client';

import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '@/core/api-base';

interface TrendingTag {
  tag: string;
  post_count: number;
}

interface TrendingTagsProps {
  onTagClick: (tag: string) => void;
}

export function TrendingTags({ onTagClick }: TrendingTagsProps) {
  const [tags, setTags] = useState<TrendingTag[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${getApiBaseUrl() || ''}/api/community/tags/trending?limit=8`, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (!cancelled) setTags(d.tags || []);
      })
      .catch(() => {
        if (!cancelled) setTags([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!tags.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-text-muted font-medium uppercase tracking-wide">Trending</span>
      {tags.map((t) => (
        <button
          key={t.tag}
          type="button"
          onClick={() => onTagClick(t.tag)}
          className="text-xs bg-accent/10 text-accent px-2.5 py-1 rounded-full hover:bg-accent/20 transition-colors"
        >
          #{t.tag}
          {t.post_count > 1 ? <span className="ml-1 text-text-muted">{t.post_count}</span> : null}
        </button>
      ))}
    </div>
  );
}
