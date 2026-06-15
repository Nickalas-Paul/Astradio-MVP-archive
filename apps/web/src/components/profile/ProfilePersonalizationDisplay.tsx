'use client';

import { Card } from '@/components/shared/Card';

export interface ProfilePersonalizationDisplayProps {
  bio?: string;
  lookingFor?: string;
  chartHighlights?: string[];
}

export function ProfilePersonalizationDisplay({
  bio,
  lookingFor,
  chartHighlights,
}: ProfilePersonalizationDisplayProps) {
  const trimmedBio = bio?.trim();
  const trimmedLookingFor = lookingFor?.trim();
  const highlights = (chartHighlights ?? []).filter((h) => h.trim().length > 0);

  if (!trimmedBio && !trimmedLookingFor && highlights.length === 0) {
    return null;
  }

  return (
    <Card elevation="resting" padding="p-5" className="space-y-4">
      {trimmedBio ? (
        <div>
          <p className="text-caption font-medium uppercase tracking-wide text-accent mb-2 font-sans">
            About
          </p>
          <p className="text-body text-text-secondary leading-relaxed whitespace-pre-wrap font-sans">
            {trimmedBio}
          </p>
        </div>
      ) : null}

      {trimmedLookingFor ? (
        <div className={trimmedBio ? 'border-t border-border pt-4' : undefined}>
          <p className="text-caption font-medium uppercase tracking-wide text-accent mb-2 font-sans">
            Looking for
          </p>
          <p className="text-body-sm text-text-secondary font-sans">{trimmedLookingFor}</p>
        </div>
      ) : null}

      {highlights.length > 0 ? (
        <div className={trimmedBio || trimmedLookingFor ? 'border-t border-border pt-4' : undefined}>
          <p className="text-caption font-medium uppercase tracking-wide text-accent mb-2 font-sans">
            Chart highlights
          </p>
          <ul className="flex flex-wrap gap-2">
            {highlights.map((h) => (
              <li
                key={h}
                className="text-caption px-3 py-1.5 rounded-full border border-accent/40 bg-accent/10 text-accent font-sans"
              >
                {h}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
