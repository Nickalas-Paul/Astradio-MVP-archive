'use client';

import { Card } from '@/components/shared/Card';

export interface EncounterCardProps {
  theme: string;
  setting: string;
  obstacle: string;
  dc: number;
  introNarration: string;
  transitDescription: string;
  saturnChapter: string;
}

export function EncounterCard({
  theme,
  setting,
  obstacle,
  dc,
  introNarration,
  transitDescription,
  saturnChapter,
}: EncounterCardProps) {
  return (
    <Card elevation="raised" size="lg" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-caption uppercase tracking-wide text-accent">Today&apos;s Encounter</p>
          <h2 className="mt-1 font-serif text-h3 text-text-primary">{theme || 'Challenge'}</h2>
        </div>
        <div className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-center">
          <p className="text-caption text-text-muted">DC</p>
          <p className="text-h4 font-semibold text-accent">{dc}</p>
        </div>
      </div>

      {introNarration ? (
        <p className="font-serif text-lg leading-relaxed text-text-secondary">{introNarration}</p>
      ) : (
        <p className="font-serif text-lg leading-relaxed text-text-secondary">{obstacle}</p>
      )}

      <div className="space-y-1 border-t border-border pt-3 text-body-sm text-text-muted">
        {obstacle && introNarration ? <p>Obstacle: {obstacle}</p> : null}
        <p>Setting: {setting || '—'}</p>
        <p>Transit: {transitDescription || '—'}</p>
        <p>Chapter: {saturnChapter}</p>
      </div>
    </Card>
  );
}
