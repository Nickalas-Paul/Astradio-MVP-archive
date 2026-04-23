/**
 * Identity export write contract (strict): no durable export_id before successful store write.
 * Optional live: IDENTITY_EXPORT_LIVE_BASE_URL + IDENTITY_EXPORT_CHART_ID → invariant
 * GET /api/profile/chart has non-null identity_export_id ⇒ GET /api/exports/:id is 200.
 */

import { runLyriaAlignedExportBlock } from '../vnext/api/run-lyria-export-block';

jest.mock('../vnext/render', () => {
  const buildLyriaPrompt = () => 'lyria test prompt for contract';
  return {
    renderWithProvider: jest.fn().mockResolvedValue({
      wavBuffer: Buffer.alloc(2048, 2),
      sha256: 'b'.repeat(64),
      size_bytes: 2048,
      provider_meta: { provider: 'lyria', modelVersion: 'lyria-002' },
    }),
    buildLyriaPrompt,
    getProvider: () => ({ name: 'lyria' }),
    localWavProvider: { render: jest.fn() },
    isProductionOrPreview: () => false,
  };
});

jest.mock('../vnext/render/export-cache', () => {
  const actual = jest.requireActual('../vnext/render/export-cache') as Record<string, unknown>;
  return {
    ...actual,
    getCachedWav: () => null,
  };
});

jest.mock('../vnext/audio/composition-narrative', () => ({
  buildCompositionNarrativePlan: () => ({ endingStyle: 'soft_end' }),
}));

const validatePass = (buf: Buffer, _sec: number) => ({
  valid: true,
  durationSec: 30,
  contractMinS: 20,
  contractMaxS: 40,
  targetDurationS: 30,
});

function minimalParams() {
  const plan = { events: [] } as any;
  const payload = { hash: 'a'.repeat(64) } as any;
  const featureVec = {} as any;
  const architecture = { guidance: {} } as any;
  const semanticCore = { claims: [] } as any;
  return { plan, payload, featureVec, architecture, semanticCore };
}

describe('runLyriaAlignedExportBlock (identity export write contract)', () => {
  const prevWav = process.env.ENABLE_WAV_EXPORT;
  const prevNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.ENABLE_WAV_EXPORT = '1';
    (process as any).__astradio_export_store = undefined;
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env.ENABLE_WAV_EXPORT = prevWav;
    process.env.NODE_ENV = prevNodeEnv;
    delete (process as any).__astradio_export_store;
  });

  test('when store.put fails, export_id is absent and export_error is storage_unavailable (no ghost id)', async () => {
    (process as any).__astradio_export_store = {
      get: async () => null,
      put: async () => {
        throw new Error('simulated durable store write failure');
      },
    };
    const p = minimalParams();
    const res = await runLyriaAlignedExportBlock(validatePass, {
      ...p,
      lyriaProfileNatalIdentity: { objectIdentityHash: 'c'.repeat(64) },
    });
    expect(res.export_id).toBeUndefined();
    expect(res.export_meta).toBeUndefined();
    expect(res.export_error).toBe('storage_unavailable');
    expect(res.audio_export_available).toBe(false);
  });

  test('when store.put succeeds, export_id and export_meta are set (durable id matches store key contract)', async () => {
    const storedKeys: string[] = [];
    (process as any).__astradio_export_store = {
      get: async () => null,
      put: async (k: string) => {
        storedKeys.push(k);
      },
    };
    const p = minimalParams();
    const res = await runLyriaAlignedExportBlock(validatePass, {
      ...p,
      lyriaProfileNatalIdentity: { objectIdentityHash: 'd'.repeat(64) },
    });
    expect(res.export_id).toBe(storedKeys[0]);
    expect(res.export_id).toMatch(/^[a-f0-9]{64}$/);
    expect(res.export_error).toBeNull();
    expect(res.audio_export_available).toBe(true);
    expect(res.export_meta).toBeDefined();
    expect(res.export_meta?.sha256).toBe('b'.repeat(64));
  });
});

describe('LIVE: profile chart identity_export_id implies export 200 (optional)', () => {
  test('profile_chart_non_null_identity_export_id_implies_export_get_200', async () => {
    const base = (process.env.IDENTITY_EXPORT_LIVE_BASE_URL || '').trim();
    if (!base) {
      // eslint-disable-next-line no-console
      console.log('[skip] set IDENTITY_EXPORT_LIVE_BASE_URL to run live invariant test');
      return;
    }
    const chartId = (process.env.IDENTITY_EXPORT_LIVE_CHART_ID || '').trim();
    if (!chartId) {
      throw new Error('IDENTITY_EXPORT_LIVE_BASE_URL is set; IDENTITY_EXPORT_LIVE_CHART_ID is required');
    }
    const rChart = await fetch(
      `${base.replace(/\/$/, '')}/api/profile/chart?chartId=${encodeURIComponent(chartId)}`
    );
    if (!rChart.ok) {
      throw new Error(`GET /api/profile/chart failed: ${rChart.status}`);
    }
    const j = (await rChart.json()) as { identity_export_id?: string | null; chart?: { identityExportId?: string | null } };
    const eid = j.identity_export_id ?? j.chart?.identityExportId ?? null;
    if (eid == null || eid === '') {
      // eslint-disable-next-line no-console
      console.log('[skip live] no identity_export_id on this chart; invariant not applicable');
      return;
    }
    if (!/^[a-f0-9]{64}$/i.test(eid)) {
      throw new Error('identity_export_id is not 64 hex');
    }
    const rEx = await fetch(`${base.replace(/\/$/, '')}/api/exports/${eid}`);
    expect(rEx.status).toBe(200);
    const buf = Buffer.from(await rEx.arrayBuffer());
    expect(buf.byteLength).toBeGreaterThan(0);
  });
});
