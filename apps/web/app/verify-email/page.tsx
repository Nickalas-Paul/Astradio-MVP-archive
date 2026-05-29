'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Card } from '@/components/shared/Card';
import { Button } from '@/components/shared/Button';
import { InputField } from '@/components/shared/Input';

type VerifyPhase = 'loading' | 'success' | 'failure';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token')?.trim() || '';

  const [phase, setPhase] = useState<VerifyPhase>(token ? 'loading' : 'failure');
  const [resendEmail, setResendEmail] = useState('');
  const [resendBusy, setResendBusy] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setPhase('failure');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
          credentials: 'same-origin',
        });
        const data = (await r.json().catch(() => ({}))) as { verified?: boolean; error?: string };
        if (cancelled) return;
        if (r.ok && data.verified === true) {
          setPhase('success');
        } else {
          setPhase('failure');
        }
      } catch {
        if (!cancelled) setPhase('failure');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (phase !== 'success') return;
    const t = window.setTimeout(() => {
      router.push('/profile');
    }, 3000);
    return () => window.clearTimeout(t);
  }, [phase, router]);

  const handleResend = async () => {
    const email = resendEmail.trim();
    if (!email.includes('@')) {
      setResendError('Enter a valid email address.');
      return;
    }
    setResendBusy(true);
    setResendError(null);
    setResendMessage(null);
    try {
      const r = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email }),
      });
      const data = (await r.json().catch(() => ({}))) as { sent?: boolean; error?: string };
      if (r.status === 429 || data.error === 'wait_before_resend') {
        setResendError('Please wait a couple of minutes before requesting another email.');
        return;
      }
      if (!r.ok) {
        setResendError(typeof data.error === 'string' ? data.error : 'Could not send verification email.');
        return;
      }
      setResendMessage('Verification email sent — check your inbox.');
    } catch {
      setResendError('Could not send verification email.');
    } finally {
      setResendBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-md mx-auto p-6">
        <Card className="space-y-6 text-center">
          <h1 className="reading-section-header">Email verification</h1>

          {phase === 'loading' && (
            <p className="text-sm text-subtext">Verifying your email…</p>
          )}

          {phase === 'success' && (
            <div className="space-y-4">
              <p className="text-sm text-text">Email verified! You can now sign in.</p>
              <p className="text-xs text-subtext">Redirecting to Profile in a few seconds…</p>
              <Link
                href="/profile"
                className="btn-primary inline-flex items-center justify-center text-center text-sm min-h-[44px] px-4 py-2 rounded-lg"
              >
                Go to Profile
              </Link>
            </div>
          )}

          {phase === 'failure' && (
            <div className="space-y-4 text-left">
              <p className="text-sm text-text text-center">
                This verification link is invalid or has expired.
              </p>
              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-sm font-medium text-text">Resend verification email</p>
                <InputField
                  type="email"
                  autoComplete="email"
                  placeholder="Email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                />
                {resendMessage && <p className="text-sm text-accent">{resendMessage}</p>}
                {resendError && <p className="text-sm text-red-500">{resendError}</p>}
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={resendBusy}
                  loading={resendBusy}
                  onClick={() => void handleResend()}
                >
                  Resend verification email
                </Button>
              </div>
              <p className="text-center text-sm text-subtext pt-2">
                <Link href="/profile" className="text-accent hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="max-w-md mx-auto p-6 text-center text-subtext text-sm">Loading…</div>
        </AppShell>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
