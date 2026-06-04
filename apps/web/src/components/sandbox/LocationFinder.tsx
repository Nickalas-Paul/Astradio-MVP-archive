'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { getApiBaseUrl } from '../../core/api-base';

export interface GeocodeResult {
  label: string;
  lat: number;
  lon: number;
  timezone: string;
}

export interface LocationFinderProps {
  value: string;
  onSelect: (result: GeocodeResult) => void;
  onClear?: () => void;
  disabled?: boolean;
  placeholder?: string;
  error?: string | null;
}

const DEBOUNCE_MS = 300;

export function LocationFinder({
  value,
  onSelect,
  onClear,
  disabled,
  placeholder = 'City, State, Country',
  error,
}: LocationFinderProps) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q || q.trim().length < 2) {
      setSuggestions([]);
      setGeocodeError(null);
      return;
    }
    setLoading(true);
    setGeocodeError(null);
    try {
      const base = getApiBaseUrl() || '';
      const res = await fetch(`${base}/api/geocode?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          res.status === 503
            ? 'Geocoding service temporarily unavailable.'
            : res.status === 504
              ? 'Geocoding request timed out.'
              : (data as { error?: string })?.error ?? `Geocoding failed (${res.status})`;
        setGeocodeError(msg);
        setSuggestions([]);
        return;
      }
      const items = Array.isArray(data) ? data : [];
      setSuggestions(items);
      if (items.length === 0) {
        setGeocodeError('No results with a valid timezone. Try a more specific location.');
      } else {
        setGeocodeError(null);
      }
    } catch (e) {
      setGeocodeError(e instanceof Error ? e.message : 'Geocoding unavailable');
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(v);
      debounceRef.current = null;
    }, DEBOUNCE_MS);
  };

  const handleSelect = (item: GeocodeResult) => {
    setQuery(item.label);
    setSuggestions([]);
    setOpen(false);
    setGeocodeError(null);
    onSelect(item);
  };

  const displayError = error ?? geocodeError;

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-text-primary mb-1">Location</label>
      <input
        type="text"
        value={query}
        onChange={handleInputChange}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        className="w-full px-3 py-2 bg-bgElev border border-border rounded-lg text-text-primary placeholder:text-text-secondary/60"
      />
      {loading && (
        <div className="absolute right-3 top-9 text-xs text-text-secondary">Searching…</div>
      )}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-bgElev border border-border rounded-lg shadow-lg">
          {suggestions.map((item, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => handleSelect(item)}
                className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-bg border-b border-border/50 last:border-b-0"
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {displayError && (
        <p className="mt-1 text-xs text-red-400">{displayError}</p>
      )}
    </div>
  );
}
