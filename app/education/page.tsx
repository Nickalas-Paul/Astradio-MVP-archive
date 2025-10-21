'use client';

import React from 'react';
import Link from 'next/link';
import VizCanvas from '../../src/components/VizCanvas';

export default function EducationPage() {
  return (
    <div className="min-h-screen bg-[#0C1320] text-zinc-100">
      <header className="w-full border-b border-white/5 sticky top-0 z-40 bg-[#0C1320]/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-emerald-400 font-semibold tracking-wide">
            Astradio
          </Link>
          <nav className="text-sm">
            <Link href="/" className="px-3 py-1.5 rounded-xl hover:bg-white/5">
              Home
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-2xl font-semibold mb-4">Education</h1>

        <section className="rounded-2xl bg-white/5 border border-white/10 p-4 mb-6">
          <h2 className="text-lg font-medium mb-3">Audio Visualization</h2>
          <VizCanvas vizPayload={{}} />
        </section>

        <section className="rounded-2xl bg-white/5 border border-white/10 p-4">
          <h2 className="text-lg font-medium mb-3">Astrological Influences</h2>
          <p className="text-sm text-zinc-400">
            Sun/Moon, dominant element, modality, guidance metrics, and student vector output
            will be documented here.
          </p>
        </section>
      </main>
    </div>
  );
}
