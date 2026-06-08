'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface ChartSearchResultItem {
  chart_id: string;
  user_id: string;
  display_name: string | null;
  handle: string | null;
  birth_date: string;
  birth_time: string | null;
  label: string;
  source: 'own' | 'connection';
}

export interface ChartSearchComboboxProps {
  value: string;
  onChange: (value: string) => void;
  /** Called when user picks a row (chart_id canonical). */
  onSelectChartId?: (chartId: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const DEBOUNCE_MS = 300;

function isDirectChartIdInput(s: string): boolean {
  const t = s.trim();
  return t.startsWith('chart_');
}

export function ChartSearchCombobox({
  value,
  onChange,
  onSelectChartId,
  disabled,
  placeholder = 'Search by name or handle',
}: ChartSearchComboboxProps) {
  const [results, setResults] = useState<ChartSearchResultItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  /** Avoid calling search API until the user focuses the import field (recents + typed queries only after focus). */
  const [searchEnabled, setSearchEnabled] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const runFetch = useCallback(async (q: string, signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('q', q);
      params.set('limit', '10');
      const response = await fetch(`/api/charts/search?${params.toString()}`, {
        credentials: 'same-origin',
        signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg =
          response.status === 401
            ? 'Sign in to search charts.'
            : typeof (data as { error?: string }).error === 'string'
              ? (data as { error: string }).error
              : 'Search unavailable.';
        throw new Error(msg);
      }
      const raw = (data as { results?: ChartSearchResultItem[] }).results;
      setResults(Array.isArray(raw) ? raw : []);
      setActiveIndex(-1);
      setOpen(true);
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Search unavailable.');
      setResults([]);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!searchEnabled) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    if (isDirectChartIdInput(value)) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      setError(null);
      return;
    }

    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      const ac = new AbortController();
      abortRef.current = ac;
      void runFetch(value.trim(), ac.signal);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, runFetch, searchEnabled]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectResult = useCallback(
    (item: ChartSearchResultItem) => {
      onChange(item.label);
      onSelectChartId?.(item.chart_id);
      setOpen(false);
      setActiveIndex(-1);
      setError(null);
    },
    [onChange, onSelectChartId]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isDirectChartIdInput(value)) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (e.key === 'Tab') {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (!open || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1 >= results.length ? 0 : i + 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
      return;
    }
    if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < results.length) {
        e.preventDefault();
        selectResult(results[activeIndex]!);
      }
    }
  };

  const showEmptyHint =
    open && !loading && !error && results.length === 0 && value.trim().length > 0 && !isDirectChartIdInput(value);

  const showRecentEmpty =
    open && !loading && !error && results.length === 0 && value.trim() === '' && !isDirectChartIdInput(value);

  return (
    <div ref={containerRef} className="relative min-w-[12rem] flex-1">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          setSearchEnabled(true);
          if (!isDirectChartIdInput(value)) {
            setOpen(true);
          }
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls="chart-search-results"
        className="w-full px-2 py-1.5 text-xs rounded-lg border border-border bg-bgElev text-text-primary"
      />
      {loading ? (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-caption text-text-secondary">
          …
        </span>
      ) : null}

      {error ? <p className="text-xs text-danger mt-1">{error}</p> : null}

      {open && !isDirectChartIdInput(value) && (results.length > 0 || showEmptyHint || showRecentEmpty) ? (
        <div
          ref={listRef}
          id="chart-search-results"
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-border bg-bgElev shadow-lg"
        >
          {results.map((result, idx) => (
            <button
              key={result.chart_id}
              type="button"
              role="option"
              aria-selected={activeIndex === idx}
              className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs text-text-primary hover:bg-bgElev/80 ${
                activeIndex === idx ? 'bg-primary/15' : ''
              }`}
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={() => selectResult(result)}
            >
              <span className="min-w-0 truncate">{result.label}</span>
              {result.source === 'own' ? (
                <span className="shrink-0 rounded border border-border/80 px-1.5 py-0.5 text-caption text-text-secondary">
                  Your chart
                </span>
              ) : (
                <span className="shrink-0 rounded border border-border/80 px-1.5 py-0.5 text-caption text-text-secondary">
                  Connection
                </span>
              )}
            </button>
          ))}
          {showEmptyHint ? (
            <div className="px-3 py-2.5 text-xs text-text-secondary">No charts found. Try a different name or handle.</div>
          ) : null}
          {showRecentEmpty ? (
            <div className="px-3 py-2.5 text-xs text-text-secondary">No saved charts yet. Sign in or connect with others to import charts.</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
