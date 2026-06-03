'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/shared/Button';
import { InputField } from '@/components/shared/Input';
import { Card } from '@/components/shared/Card';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token =
    searchParams.get('reset_token')?.trim() ||
    searchParams.get('token')?.trim() ||
    '';
  const email = searchParams.get('email')?.trim() || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const canSubmit =
    token.length > 0 &&
    email.includes('@') &&
    password.length >= 8 &&
    password === confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, password }),
      });
      const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!r.ok) {
        setError(
          data.error === 'invalid_token'
            ? 'This reset link is invalid or has expired. Request a new link from the login page.'
            : typeof data.error === 'string'
              ? data.error
              : 'Could not reset password.',
        );
        return;
      }
      setSuccess(true);
    } finally {
      setBusy(false);
    }
  };

  if (!token || !email) {
    return (
      <Card className="max-w-md mx-auto space-y-4">
        <h1 className="reading-section-header">Invalid link</h1>
        <p className="text-sm text-text-secondary">
          This password reset link is missing required parameters. Request a new link from the login
          page.
        </p>
        <Link href="/profile" className="text-accent text-sm hover:underline">
          Back to sign in
        </Link>
      </Card>
    );
  }

  if (success) {
    return (
      <Card className="max-w-md mx-auto space-y-4">
        <h1 className="reading-section-header">Password updated</h1>
        <p className="text-sm text-text-secondary">Your password has been reset. You can sign in now.</p>
        <Link href="/profile">
          <Button variant="primary" size="sm">
            Sign in
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <Card className="max-w-md mx-auto space-y-4">
      <h1 className="reading-section-header">Choose a new password</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <InputField
          type="password"
          autoComplete="new-password"
          placeholder="New password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <InputField
          type="password"
          autoComplete="new-password"
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button type="submit" variant="primary" size="sm" disabled={!canSubmit || busy} loading={busy}>
          Reset password
        </Button>
      </form>
      <Link href="/profile" className="text-accent text-sm hover:underline">
        Back to sign in
      </Link>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-bg px-4 py-12">
      <Suspense fallback={<p className="text-center text-subtext">Loading…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
