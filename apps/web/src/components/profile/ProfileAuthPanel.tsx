'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { LocationFinder } from '../sandbox/LocationFinder';
import { isPersistableChartTimezone } from '../../core/chart-timezone-guard';
import { Button } from '@/components/shared/Button';
import { InputField } from '@/components/shared/Input';
import { Tabs } from '@/components/shared/Tabs';
import { Card } from '@/components/shared/Card';

export interface ProfileAuthPanelProps {
  onAuthSuccess: () => void | Promise<void>;
}

async function resendVerificationEmail(email: string): Promise<{ ok: boolean; error?: string }> {
  const r = await fetch('/api/auth/resend-verification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ email: email.trim() }),
  });
  const data = (await r.json().catch(() => ({}))) as { error?: string };
  if (r.status === 429 || data.error === 'wait_before_resend') {
    return { ok: false, error: 'Please wait a couple of minutes before requesting another email.' };
  }
  if (!r.ok) {
    return { ok: false, error: typeof data.error === 'string' ? data.error : 'Could not send verification email.' };
  }
  return { ok: true };
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
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [loginNeedsVerification, setLoginNeedsVerification] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendNotice, setResendNotice] = useState<string | null>(null);

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

  const handleResend = async (email: string) => {
    setResendBusy(true);
    setResendNotice(null);
    setAuthError(null);
    try {
      const result = await resendVerificationEmail(email);
      if (!result.ok) {
        setAuthError(result.error || 'Could not send verification email.');
        return;
      }
      setResendNotice('Verification email sent — check your inbox.');
    } finally {
      setResendBusy(false);
    }
  };

  if (pendingVerificationEmail) {
    return (
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="space-y-6 max-w-lg">
            <h2 className="reading-section-header">Check your email</h2>
            <p className="text-sm text-text">
              Account created! Check your email for a verification link to get started.
            </p>
            <p className="text-xs text-subtext">We sent a link to {pendingVerificationEmail}.</p>
            {resendNotice && <p className="text-sm text-accent">{resendNotice}</p>}
            {authError && <p className="text-sm text-red-500">{authError}</p>}
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={resendBusy}
                loading={resendBusy}
                onClick={() => void handleResend(pendingVerificationEmail)}
              >
                Resend verification email
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  setPendingVerificationEmail(null);
                  setAuthTab('login');
                  setLoginEmail(pendingVerificationEmail);
                  setResendNotice(null);
                  setAuthError(null);
                }}
              >
                Sign in
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="space-y-6">
        <h2 className="text-xl font-semibold text-text">Sign in to Astradio</h2>
        <p className="text-sm text-subtext">
          Register with email and password, or log in to continue. Your natal chart is saved with your account.
        </p>
        <Tabs
          variant="underline"
          ariaLabel="Sign in or register"
          tabs={[
            { id: 'register', label: 'Register' },
            { id: 'login', label: 'Log in' },
          ]}
          activeTab={authTab}
          onTabChange={(id) => {
            setAuthTab(id as 'register' | 'login');
            setAuthError(null);
            setLoginNeedsVerification(false);
            setResendNotice(null);
          }}
        />

        {authTab === 'login' ? (
          <div className="rounded-lg border border-border bg-bgElev p-4 space-y-4 max-w-md">
            <InputField
              type="email"
              autoComplete="email"
              placeholder="Email"
              value={loginEmail}
              onChange={(e) => {
                setLoginEmail(e.target.value);
                setLoginNeedsVerification(false);
              }}
            />
            <InputField
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
            />
            {loginNeedsVerification ? (
              <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="text-sm text-text">
                  Your email hasn&apos;t been verified yet. Check your inbox for a verification link.
                </p>
                {resendNotice && <p className="text-sm text-accent">{resendNotice}</p>}
                {authError && <p className="text-sm text-red-500">{authError}</p>}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={resendBusy}
                  loading={resendBusy}
                  onClick={() => void handleResend(loginEmail)}
                >
                  Resend verification email
                </Button>
              </div>
            ) : (
              authError && <p className="text-red-500 text-xs">{authError}</p>
            )}
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={authBusy || !canLogin}
              loading={authBusy}
              onClick={async () => {
                setAuthBusy(true);
                setAuthError(null);
                setLoginNeedsVerification(false);
                setResendNotice(null);
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
                  if (r.status === 403 && data.error === 'email_not_verified') {
                    setLoginNeedsVerification(true);
                    return;
                  }
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
              Log in
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-bgElev p-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <InputField
                type="email"
                autoComplete="email"
                placeholder="Email"
                value={registerEmail}
                onChange={(e) => setRegisterEmail(e.target.value)}
              />
              <InputField
                type="password"
                autoComplete="new-password"
                placeholder="Password (min 8 characters)"
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
              />
            </div>
            <InputField
              placeholder="Display name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
            />
            <InputField
              placeholder="Handle (optional)"
              value={createHandle}
              onChange={(e) => setCreateHandle(e.target.value)}
            />
            <div className="space-y-3 border-t border-border pt-4">
              <h3 className="text-sm font-medium text-text">Birth chart (required)</h3>
              <InputField
                placeholder="Label (e.g. My Natal)"
                value={createChartLabel}
                onChange={(e) => setCreateChartLabel(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <InputField
                  type="date"
                  value={createChartDate}
                  onChange={(e) => setCreateChartDate(e.target.value)}
                  required
                />
                <InputField
                  type="time"
                  value={createChartTime}
                  onChange={(e) => setCreateChartTime(e.target.value)}
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
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={creating || authBusy || !canRegister}
              loading={creating || authBusy}
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
                  const registeredEmail = registerEmail.trim();
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
                  setRegisterEmail('');
                  setPendingVerificationEmail(registeredEmail);
                } finally {
                  setCreating(false);
                }
              }}
            >
              Create account
            </Button>
            <p className="text-xs text-subtext">
              Already verified?{' '}
              <button
                type="button"
                className="text-accent hover:underline"
                onClick={() => setAuthTab('login')}
              >
                Sign in
              </button>
            </p>
          </div>
        )}
        </Card>
      </motion.div>
    </div>
  );
}
