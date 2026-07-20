'use client';

import { Card } from '@/components/shared/Card';

export interface RevealHintProps {
  hint: string | null;
}

export function RevealHint({ hint }: RevealHintProps) {
  if (!hint) return null;
  return (
    <Card elevation="resting" size="sm" highlighted>
      <p className="font-serif text-body text-accent">✧ {hint}</p>
    </Card>
  );
}
