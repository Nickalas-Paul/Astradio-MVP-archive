'use client';

import React from 'react';

type Cb = (v: string) => void;

const labelClass = 'text-caption text-text-muted';

export function DateInput({
  value,
  onChange,
  disabled,
}: { value: string; onChange: Cb; disabled?: boolean }) {
  return (
    <label className="flex flex-col gap-1">
      <span className={labelClass}>Date</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="input rounded-xl"
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
      <span className={labelClass}>Time</span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="input rounded-xl"
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
      <span className={labelClass}>Location</span>
      <input
        type="text"
        value={value}
        placeholder="Current Location"
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="input rounded-xl"
      />
    </label>
  );
}

export default {};
