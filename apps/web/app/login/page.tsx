'use client';

import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-6">
        <h1 className="text-2xl font-bold text-text">Sign In</h1>
        <p className="text-subtext text-sm">
          Auth is not yet implemented. Use the main app to explore charts and compose.
        </p>
        <Link
          href="/"
          className="inline-block px-4 py-2 rounded-xl bg-emerald/20 border border-emerald/40 text-emerald hover:bg-emerald/30"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
