import React from 'react';
import { buildCampaignView } from '../../../../../../vnext/rpg/campaign/view';

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
    // eslint-disable-next-line no-console
    console.error('[rpg/campaign] failed to build campaign view', e);
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Campaign view unavailable</h1>
          <p style={{ fontSize: '14px', color: '#aaa' }}>
            The RPG campaign backend returned an error for this request. Please verify the backend environment and try again.
          </p>
        </div>
      </main>
    );
  }

  const sheet = view.character_sheet;
  const turn = view.current_turn;
  const outcome = view.outcome;
  const audio = view.audio;

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
              <ul>
                {turn.choice_ids.map((id: string) => {
                  const tags = turn.choice_tags_by_id[id] || [];
                  const isSelected = turn.selected_choice_id === id;
                  return (
                    <li key={id}>
                      <button type="button" disabled={turn.has_responded} style={{ marginRight: '8px' }}>
                        {id}
                      </button>
                      <span>{tags.join(', ')}</span>
                      {isSelected && <span style={{ marginLeft: '8px' }}>✓ selected</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        ) : (
          <div>No turn yet.</div>
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
            <div>No outcome yet.</div>
          )}
        </div>

        <div style={{ marginTop: '24px' }}>
          <h2>Audio</h2>
          {audio ? (
            <div>
              <div>Provider: {audio.provider}</div>
              <div>Status: {audio.status}</div>
              <div>Audio seed: {audio.audio_seed}</div>
              {audio.artifact_url ? (
                <audio controls src={audio.artifact_url} />
              ) : (
                <div>No artifact URL yet.</div>
              )}
            </div>
          ) : (
            <div>No audio record yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}

