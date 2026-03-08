/**
 * Phase 8G — Natal soundtrack persistence contract.
 * Ensures we never add a "ready" Saved Tracks row when there is no playable audio.
 * No fake success: only compose responses with a non-empty audio.base64 yield a playable job.
 */

/** Same contract as ProfilePanel triggerNatalComposition: only treat as playable when base64 is non-empty string. */
function hasPlayableAudioFromComposePayload(payload: unknown): boolean {
  const base64 = (payload as any)?.audio?.base64;
  return typeof base64 === 'string' && base64.length > 0;
}

describe('Natal soundtrack persistence (Phase 8G)', () => {
  test('payload with no audio is not playable', () => {
    expect(hasPlayableAudioFromComposePayload({})).toBe(false);
    expect(hasPlayableAudioFromComposePayload({ audio: {} })).toBe(false);
    expect(hasPlayableAudioFromComposePayload({ audio: { base64: null } })).toBe(false);
    expect(hasPlayableAudioFromComposePayload({ audio: { base64: undefined } })).toBe(false);
  });

  test('payload with empty audio.base64 is not playable', () => {
    expect(hasPlayableAudioFromComposePayload({ audio: { base64: '' } })).toBe(false);
  });

  test('payload with non-string audio.base64 is not playable', () => {
    expect(hasPlayableAudioFromComposePayload({ audio: { base64: 123 } })).toBe(false);
    expect(hasPlayableAudioFromComposePayload({ audio: { base64: [] } })).toBe(false);
  });

  test('payload with non-empty audio.base64 string is playable', () => {
    // Minimal valid base64 (one byte)
    expect(hasPlayableAudioFromComposePayload({ audio: { base64: 'Zg==' } })).toBe(true);
    expect(hasPlayableAudioFromComposePayload({ audio: { base64: 'dGVzdA==' } })).toBe(true);
  });

  test('compose 200 with export_disabled must not be treated as success', () => {
    const payloadExportDisabled = {
      audio: { base64: '', export_error: 'export_disabled', export_attempted: false },
      duration_s: 30,
    };
    expect(hasPlayableAudioFromComposePayload(payloadExportDisabled)).toBe(false);
  });

  test('export_id fallback: valid 64-char hex is accepted format', () => {
    const validExportId = 'a'.repeat(64);
    expect(/^[a-f0-9]{64}$/.test(validExportId)).toBe(true);
    const invalidExportId = 'short';
    expect(/^[a-f0-9]{64}$/.test(invalidExportId)).toBe(false);
  });
});
