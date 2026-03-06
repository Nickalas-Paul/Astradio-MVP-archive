import React from 'react';
import { buildCampaignView } from '../../../../../../vnext/rpg/campaign/view';
import { LyriaAudio } from '../../../../src/components/LyriaAudio';
import { CampaignTurnClient } from './CampaignTurnClient';

export const runtime = 'nodejs';

type PageProps = {
  params: { campaignId: string };
  searchParams: { userId?: string };
};

export default async function CampaignPage({ params, searchParams }: PageProps) {
  const campaignId = params.campaignId;
  const userId = searchParams.userId;

  if (!userId) {
    throw new Error('userId query parameter required for RPG campaign view');
  }

  const hasPostgres = Boolean(process.env.POSTGRES_URL);
  if (!hasPostgres) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Campaign backend not configured</h1>
          <p style={{ fontSize: '14px', color: '#aaa' }}>
            The RPG campaign view requires the POSTGRES_URL environment variable to be set for this deployment.
          </p>
        </div>
      </main>
    );
  }

  let view;
  try {
    view = await buildCampaignView({ campaignId, userId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.error('[rpg/campaign] failed to build campaign view', e);
    if (msg.includes('[rpg-ui] Campaign not found')) {
      // eslint-disable-next-line no-console
      console.log(`[rpg-campaign] missing_dependency=campaign campaignId=${campaignId}`);
    } else if (msg.includes('[rpg-ui] Bundle not found')) {
      // eslint-disable-next-line no-console
      console.log(`[rpg-campaign] missing_dependency=bundle campaignId=${campaignId}`);
    }
    let heading = 'Campaign view unavailable';
    let detail =
      'The RPG campaign backend returned an error for this request. Please verify the backend environment and try again.';
    if (msg.includes('[rpg-ui] Campaign not found')) {
      heading = 'Campaign not found';
      detail = 'Check campaign ID and that the campaign exists in the database.';
    } else if (msg.includes('[rpg-ui] Bundle not found')) {
      heading = 'Character data not found';
      detail = 'Character data (bundle) not found for this campaign. The campaign may be misconfigured.';
    } else if (process.env.NODE_ENV === 'development') {
      detail = `${detail} ${msg.slice(0, 120)}`;
    }
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>{heading}</h1>
          <p style={{ fontSize: '14px', color: '#aaa' }}>{detail}</p>
        </div>
      </main>
    );
  }

  const sheet = view.character_sheet;
  const turn = view.current_turn;
  const outcome = view.outcome;
  const audio = view.audio;
  const diag = view._diagnostics;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', padding: '24px' }}>
      <section>
        <h2>Character Sheet</h2>
        <div>
          <div>Class: {sheet.class_slug}</div>
          <div>Subclass: {sheet.subclass_slug}</div>
          <div>Rising: {sheet.rising_modifier_slug}</div>
        </div>
        <div style={{ marginTop: '16px' }}>
          <h3>Top Domains</h3>
          {sheet.top_domains.map((d: any) => (
            <div key={d.domain} style={{ marginBottom: '4px' }}>
              <span style={{ display: 'inline-block', width: '140px' }}>{d.domain}</span>
              <span style={{ display: 'inline-block', width: '120px', background: '#eee' }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: `${Math.max(5, Math.min(100, d.score * 100))}%`,
                    background: '#333',
                    height: '6px',
                  }}
                />
              </span>
              <span style={{ marginLeft: '8px' }}>{d.score.toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '16px' }}>
          <h3>Placements</h3>
          <ul>
            {sheet.placements.map((p: any) => (
              <li key={`${p.body}-${p.house}`}>
                <strong>{p.body}</strong> in {p.sign} (house {p.house}) — {p.domains.join(', ')}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <h2>Daily Turn</h2>
        {turn ? (
          <div>
            <div>Scenario: {turn.scenario_id}</div>
            <div>Tags: {turn.scenario_tags.join(', ')}</div>
            <div>Tone: {turn.tone_tag}</div>
            <div style={{ marginTop: '12px' }}>
              <h3>Choices</h3>
              <CampaignTurnClient userId={userId} turn={turn} hasOutcome={Boolean(outcome)} />
            </div>
          </div>
        ) : (
          <div>
            <div>No turn yet.</div>
            {diag?.no_turn_reason && (
              <p style={{ fontSize: '13px', color: '#888', marginTop: '8px' }}>{diag.no_turn_reason}</p>
            )}
          </div>
        )}

        <div style={{ marginTop: '24px' }}>
          <h2>Outcome</h2>
          {outcome ? (
            <div>
              <div>Outcome patch: {outcome.outcome_patch_id}</div>
              <div>Chapter: {outcome.chapter}</div>
              <h3 style={{ marginTop: '8px' }}>Top Domains</h3>
              <ul>
                {outcome.top_domains.map((d: any) => (
                  <li key={d.domain}>
                    {d.domain}: {d.weight.toFixed(2)}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div>
              <div>No outcome yet.</div>
              <p style={{ fontSize: '13px', color: '#888', marginTop: '8px' }}>
                Outcome appears after you submit a choice and finalize the turn.
              </p>
            </div>
          )}
        </div>

        <div style={{ marginTop: '24px' }}>
          <h2>Audio</h2>
          {(() => {
            const classification = diag?.audio_classification;
            if (classification === 'not_enabled') {
              return (
                <div>
                  <div>Audio is not enabled for this phase.</div>
                  <p style={{ fontSize: '13px', color: '#888', marginTop: '8px' }}>
                    RPG_AUDIO_PROVIDER is set to &quot;none&quot;. No audio record is created or played.
                  </p>
                </div>
              );
            }
            if (classification === 'no_record') {
              return (
                <div>
                  <div>No audio record yet.</div>
                  {diag?.no_audio_reason && (
                    <p style={{ fontSize: '13px', color: '#888', marginTop: '8px' }}>{diag.no_audio_reason}</p>
                  )}
                </div>
              );
            }
            if (classification === 'pending') {
              return (
                <div>
                  <div>Audio is pending.</div>
                  <p style={{ fontSize: '13px', color: '#888', marginTop: '8px' }}>
                    Generation has been requested; artifact not ready yet.
                  </p>
                </div>
              );
            }
            if (classification === 'failed') {
              return (
                <div>
                  <div>Audio generation failed.</div>
                  <p style={{ fontSize: '13px', color: '#888', marginTop: '8px' }}>
                    The audio artifact could not be produced for this turn.
                  </p>
                </div>
              );
            }
            if (classification === 'playable' && audio?.artifact_url) {
              return (
                <div>
                  <div>Provider: {audio.provider}</div>
                  <div>Status: {audio.status}</div>
                  <div>Audio seed: {audio.audio_seed}</div>
                  <LyriaAudio url={audio.artifact_url} />
                </div>
              );
            }
            if (audio) {
              return (
                <div>
                  <div>Provider: {audio.provider}</div>
                  <div>Status: {audio.status}</div>
                  <div>Audio seed: {audio.audio_seed}</div>
                  {audio.status === 'failed' ? (
                    <div>Audio generation failed.</div>
                  ) : audio.status === 'pending' ? (
                    <div>Audio is pending.</div>
                  ) : audio.artifact_url ? (
                    <LyriaAudio url={audio.artifact_url} />
                  ) : (
                    <div>No artifact URL yet.</div>
                  )}
                </div>
              );
            }
            return (
              <div>
                <div>No audio record yet.</div>
                {turn ? (
                  diag?.no_audio_reason && (
                    <p style={{ fontSize: '13px', color: '#888', marginTop: '8px' }}>{diag.no_audio_reason}</p>
                  )
                ) : (
                  <p style={{ fontSize: '13px', color: '#888', marginTop: '8px' }}>
                    Create a daily turn first; then request audio for that turn.
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      </section>
    </div>
  );
}

