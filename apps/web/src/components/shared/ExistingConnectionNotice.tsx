'use client';

import Link from 'next/link';
import { Card } from '@/components/shared/Card';
import { Button } from '@/components/shared/Button';

export function ExistingConnectionNotice({ relationshipId }: { relationshipId?: string }) {
  const href = relationshipId
    ? `/community/relationship/${encodeURIComponent(relationshipId)}`
    : null;

  return (
    <Card size="sm" className="border-accent/30 bg-accent/5 text-center space-y-2">
      <p className="text-body-sm text-text-secondary">You have a connection reading with this person.</p>
      {href ? (
        <Link href={href}>
          <Button variant="ghost" size="sm" type="button">
            View your connection reading
          </Button>
        </Link>
      ) : null}
    </Card>
  );
}
