'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RpgTurnView } from '../../../../../../vnext/rpg/campaign/view';

type CampaignTurnClientProps = {
  userId: string;
  turn: RpgTurnView;
  hasOutcome: boolean;
};

export function CampaignTurnClient({ userId, turn, hasOutcome }: CampaignTurnClientProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLocked = turn.has_responded || hasOutcome;

  async function handleChoiceClick(choiceId: string) {
    if (isLocked || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const respondRes = await fetch(`/api/rpg/turn/${turn.id}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, choiceId }),
      });

      if (!respondRes.ok) {
        let detail = '';
        try {
          detail = (await respondRes.text()).slice(0, 200);
        } catch {
          // ignore
        }
        throw new Error(
          `Choice submission failed (${respondRes.status}).${detail ? ` ${detail}` : ''}`,
        );
      }

      const finalizeRes = await fetch(`/api/rpg/turn/${turn.id}/finalize`, {
        method: 'POST',
      });

      if (!finalizeRes.ok) {
        let detail = '';
        try {
          detail = (await finalizeRes.text()).slice(0, 200);
        } catch {
          // ignore
        }
        throw new Error(
          `Turn finalization failed (${finalizeRes.status}).${detail ? ` ${detail}` : ''}`,
        );
      }

      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.error('[rpg-campaign] choice_or_finalize_failed', err);
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <ul>
        {turn.choice_ids.map((id) => {
          const tags = turn.choice_tags_by_id[id] || [];
          const isSelected = turn.selected_choice_id === id;
          return (
            <li key={id}>
              <button
                type="button"
                disabled={isLocked || isSubmitting}
                onClick={() => handleChoiceClick(id)}
                style={{ marginRight: '8px' }}
              >
                {id}
              </button>
              <span>{tags.join(', ')}</span>
              {isSelected && <span style={{ marginLeft: '8px' }}>✓ selected</span>}
            </li>
          );
        })}
      </ul>
      {isSubmitting && (
        <p style={{ fontSize: '13px', color: '#888', marginTop: '8px' }}>
          Submitting choice and finalizing turn&hellip;
        </p>
      )}
      {error && (
        <p style={{ fontSize: '13px', color: '#c00', marginTop: '8px' }}>
          {error}
        </p>
      )}
      {isLocked && !hasOutcome && !isSubmitting && (
        <p style={{ fontSize: '13px', color: '#888', marginTop: '8px' }}>
          Response recorded for this turn; waiting for outcome. If no outcome appears, check the backend logs.
        </p>
      )}
    </>
  );
}

