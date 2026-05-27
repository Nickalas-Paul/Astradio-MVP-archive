'use client';

import React from 'react';

type Cb = (v: string) => void;

export function DateInput({
  value,
  onChange,
  disabled,
}: { value: string; onChange: Cb; disabled?: boolean }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-zinc-400">Date</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-accent/60"
      />
    </label>
  );
}

export function TimeInput({
  value,
  onChange,
  disabled,
}: { value: string; onChange: Cb; disabled?: boolean }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-zinc-400">Time</span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-accent/60"
      />
    </label>
  );
}

export function LocationInput({
  value,
  onChange,
  disabled,
}: { value: string; onChange: Cb; disabled?: boolean }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-zinc-400">Location</span>
      <input
        type="text"
        value={value}
        placeholder="Current Location"
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-xl bg-[#0F172A] border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-accent/60"
      />
    </label>
  );
}

export default {};
