'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { LocationFinder } from '../sandbox/LocationFinder';
import { isPersistableChartTimezone } from '../../core/chart-timezone-guard';

export interface ProfileAuthPanelProps {
  onAuthSuccess: () => void | Promise<void>;
}

export function ProfileAuthPanel({ onAuthSuccess }: ProfileAuthPanelProps) {
  const [createName, setCreateName] = useState('');
  const [createHandle, setCreateHandle] = useState('');
  const [createChartLabel, setCreateChartLabel] = useState('');
  const [createChartDate, setCreateChartDate] = useState('');
  const [createChartTime, setCreateChartTime] = useState('12:00');
  const [createChartLat, setCreateChartLat] = useState('');
  const [createChartLon, setCreateChartLon] = useState('');
  const [createChartTz, setCreateChartTz] = useState('');
  const [createChartLocationLabel, setCreateChartLocationLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [authTab, setAuthTab] = useState<'register' | 'login'>('register');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const chartPayload = {
    label: createChartLabel.trim() || 'My Natal',
    date: createChartDate,
    time: createChartTime,
    lat: Number(createChartLat),
    lon: Number(createChartLon),
    timezone: createChartTz.trim(),
  };
  const chartReady =
    createChartDate &&
    createChartTime &&
    createChartLat !== '' &&
    createChartLon !== '' &&
    isPersistableChartTimezone(createChartTz) &&
    Number.isFinite(Number(createChartLat)) &&
    Number.isFinite(Number(createChartLon));
  const canRegister =
    registerEmail.trim().includes('@') &&
    registerPassword.length >= 8 &&
    createName.trim() &&
    chartReady;
  const canLogin = loginEmail.trim().includes('@') && loginPassword.length >= 1;

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card space-y-6"
      >
        <h2 className="text-xl font-semibold text-text">Sign in to Astradio</h2>
        <p className="text-sm text-subtext">
          Register with email and password, or log in to continue. Your natal chart is saved with your account.
        </p>
        <div className="flex gap-2 border-b border-border pb-2">
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
              authTab === 'register' ? 'bg-bgElev text-text border border-b-0 border-border' : 'text-subtext'
            }`}
            onClick={() => {
              setAuthTab('register');
              setAuthError(null);
            }}
          >
            Register
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
              authTab === 'login' ? 'bg-bgElev text-text border border-b-0 border-border' : 'text-subtext'
            }`}
            onClick={() => {
              setAuthTab('login');
              setAuthError(null);
            }}
          >
            Log in
          </button>
        </div>

        {authTab === 'login' ? (
          <div className="rounded-lg border border-border bg-bgElev p-4 space-y-4 max-w-md">
            <input
              type="email"
              autoComplete="email"
              placeholder="Email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              className="input w-full"
            />
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="input w-full"
            />
            {authError && <p className="text-red-500 text-xs">{authError}</p>}
            <button
              type="button"
              disabled={authBusy || !canLogin}
              className="px-4 py-2.5 rounded-lg bg-emerald-500 text-white text-sm font-medium disabled:opacity-50"
              onClick={async () => {
                setAuthBusy(true);
                setAuthError(null);
                try {
                  const r = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                      email: loginEmail.trim(),
                      password: loginPassword,
                    }),
                  });
                  const data = await r.json().catch(() => ({}));
                  if (!r.ok) {
                    setAuthError(typeof data.error === 'string' ? data.error : 'Login failed');
                    return;
                  }
                  setLoginPassword('');
                  await onAuthSuccess();
                } finally {
                  setAuthBusy(false);
                }
              }}
            >
              {authBusy ? 'Signing in…' : 'Log in'}
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-bgElev p-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <input
                type="email"
                autoComplete="email"
                placeholder="Email"
                value={registerEmail}
                onChange={(e) => setRegisterEmail(e.target.value)}
                className="input w-full"
              />
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Password (min 8 characters)"
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
                className="input w-full"
              />
            </div>
            <input
              placeholder="Display name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              className="input w-full"
            />
            <input
              placeholder="Handle (optional)"
              value={createHandle}
              onChange={(e) => setCreateHandle(e.target.value)}
              className="input w-full"
            />
            <div className="space-y-3 border-t border-border pt-4">
              <h3 className="text-sm font-medium text-text">Birth chart (required)</h3>
              <input
                placeholder="Label (e.g. My Natal)"
                value={createChartLabel}
                onChange={(e) => setCreateChartLabel(e.target.value)}
                className="input w-full"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={createChartDate}
                  onChange={(e) => setCreateChartDate(e.target.value)}
                  className="input w-full"
                  required
                />
                <input
                  type="time"
                  value={createChartTime}
                  onChange={(e) => setCreateChartTime(e.target.value)}
                  className="input w-full"
                  required
                />
              </div>
              <LocationFinder
                value={createChartLocationLabel}
                onSelect={(r) => {
                  setCreateChartLocationLabel(r.label);
                  setCreateChartLat(String(r.lat));
                  setCreateChartLon(String(r.lon));
                  setCreateChartTz(r.timezone && isPersistableChartTimezone(r.timezone) ? r.timezone : '');
                }}
                onClear={() => {
                  setCreateChartLocationLabel('');
                  setCreateChartLat('');
                  setCreateChartLon('');
                  setCreateChartTz('');
                }}
                placeholder="Birth place (city, region, or address)"
              />
            </div>
            {(createError || authError) && (
              <p className="text-red-500 text-xs">{authError || createError}</p>
            )}
            <button
              type="button"
              disabled={creating || authBusy || !canRegister}
              className="px-4 py-2.5 rounded-lg bg-emerald-500 text-white text-sm font-medium disabled:opacity-50"
              onClick={async () => {
                setCreating(true);
                setCreateError(null);
                setAuthError(null);
                try {
                  const body = {
                    email: registerEmail.trim(),
                    password: registerPassword,
                    displayName: createName.trim(),
                    handle: createHandle.trim() || undefined,
                    chart: chartPayload,
                  };
                  const r = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify(body),
                  });
                  const data = await r.json().catch(() => ({}));
                  if (!r.ok) {
                    const msg =
                      typeof data.error === 'string'
                        ? data.error
                        : typeof data.message === 'string'
                          ? data.message
                          : 'Registration failed';
                    setAuthError(msg);
                    return;
                  }
                  setRegisterPassword('');
                  setCreateName('');
                  setCreateHandle('');
                  setCreateChartLabel('');
                  setCreateChartDate('');
                  setCreateChartTime('12:00');
                  setCreateChartLat('');
                  setCreateChartLon('');
                  setCreateChartTz('');
                  setCreateChartLocationLabel('');
                  await onAuthSuccess();
                } finally {
                  setCreating(false);
                }
              }}
            >
              {creating || authBusy ? 'Creating account…' : 'Create account'}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
