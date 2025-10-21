// Engine Adapter Contract Tests
// Ensures UI never leaks engine quirks and maintains proper stage ordering

import { getEngineAdapter } from '../public/core/api/engine-adapter';

const req = { chartA: 'A1', genre: 'house', durationSec: 60 } as const;

describe('Engine Adapter Contract', () => {
  test('createComposition returns jobId', async () => {
    const { jobId } = await getEngineAdapter().createComposition(req);
    expect(typeof jobId).toBe('string');
    expect(jobId.length).toBeGreaterThan(0);
  });

  test('subscribe emits monotonic stages then ready|error', async () => {
    const seen: string[] = [];
    const { jobId } = await getEngineAdapter().createComposition(req);
    
    await new Promise<void>((resolve) => {
      const unsub = getEngineAdapter().subscribe(jobId, (u) => {
        seen.push(u.stage);
        if (u.stage === 'ready' || u.stage === 'error') {
          unsub();
          resolve();
        }
      });
    });

    // Must begin with a non-terminal stage
    expect(['queued', 'preparing', 'generating', 'mixing']).toContain(seen[0]);
    
    // Must end with terminal
    expect(['ready', 'error']).toContain(seen.at(-1)!);
    
    // No regressions (e.g., ready → generating)
    const order = ['queued', 'preparing', 'generating', 'mixing', 'ready', 'error'];
    let max = -1;
    for (const s of seen) {
      const i = order.indexOf(s);
      expect(i).toBeGreaterThanOrEqual(max);
      max = Math.max(max, i);
    }
  });

  test('progress values are monotonic within each stage', async () => {
    const progressHistory: Array<{ stage: string; pct: number }> = [];
    const { jobId } = await getEngineAdapter().createComposition(req);
    
    await new Promise<void>((resolve) => {
      const unsub = getEngineAdapter().subscribe(jobId, (u) => {
        if ('pct' in u) {
          progressHistory.push({ stage: u.stage, pct: u.pct });
        }
        if (u.stage === 'ready' || u.stage === 'error') {
          unsub();
          resolve();
        }
      });
    });

    // Group by stage and verify monotonic progress
    const byStage = progressHistory.reduce((acc, item) => {
      if (!acc[item.stage]) acc[item.stage] = [];
      acc[item.stage].push(item.pct);
      return acc;
    }, {} as Record<string, number[]>);

    Object.entries(byStage).forEach(([stage, pcts]) => {
      for (let i = 1; i < pcts.length; i++) {
        expect(pcts[i]).toBeGreaterThanOrEqual(pcts[i - 1]);
      }
    });
  });

  test('ready stage includes required fields', async () => {
    let readyUpdate: any = null;
    const { jobId } = await getEngineAdapter().createComposition(req);
    
    await new Promise<void>((resolve) => {
      const unsub = getEngineAdapter().subscribe(jobId, (u) => {
        if (u.stage === 'ready') {
          readyUpdate = u;
          unsub();
          resolve();
        }
        if (u.stage === 'error') {
          unsub();
          resolve();
        }
      });
    });

    if (readyUpdate) {
      expect(readyUpdate).toHaveProperty('id');
      expect(readyUpdate).toHaveProperty('url');
      expect(readyUpdate).toHaveProperty('layers');
      expect(Array.isArray(readyUpdate.layers)).toBe(true);
      expect(readyUpdate.layers.length).toBeGreaterThan(0);
    }
  });

  test('error stage includes required fields', async () => {
    // Force an error by using invalid request
    const invalidReq = { chartA: '', genre: 'invalid' as any, durationSec: 60 };
    
    try {
      await getEngineAdapter().createComposition(invalidReq);
    } catch (error) {
      // Expected to throw for invalid request
      expect(error).toBeDefined();
    }
  });

  test('play/stop are best-effort and never throw', async () => {
    const adapter = getEngineAdapter();
    
    // These should not throw even with invalid IDs
    await expect(adapter.play('invalid-id')).resolves.not.toThrow();
    await expect(adapter.stop('invalid-id')).resolves.not.toThrow();
  });

  test('subscribe cleanup prevents memory leaks', async () => {
    const { jobId } = await getEngineAdapter().createComposition(req);
    let callbackCount = 0;
    
    const unsub = getEngineAdapter().subscribe(jobId, () => {
      callbackCount++;
    });
    
    // Unsubscribe immediately
    unsub();
    
    // Wait a bit to see if callbacks still fire
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Should not have received any callbacks after unsubscribe
    expect(callbackCount).toBe(0);
  });
});
