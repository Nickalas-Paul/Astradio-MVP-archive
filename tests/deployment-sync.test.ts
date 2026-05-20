/**
 * Ensures deploy metadata and natal synastry bullet system are wired for unified deployments.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const vnextRoot = path.join(__dirname, '..', 'dist', 'vnext', 'vnext');

describe('deployment sync', () => {
  it('deploy-meta module is built', () => {
    const metaPath = path.join(vnextRoot, 'deploy-meta.js');
    expect(fs.existsSync(metaPath)).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getDeployMeta } = require(metaPath) as {
      getDeployMeta: () => { bulletSystem: string };
    };
    expect(getDeployMeta().bulletSystem).toBe('library-synastry');
  });

  it('matches module uses natal synastry bullets without Discovery transit amplification', () => {
    const matchesPath = path.join(vnextRoot, 'compat', 'matches.js');
    expect(fs.existsSync(matchesPath)).toBe(true);
    const src = fs.readFileSync(matchesPath, 'utf8');
    expect(src).not.toMatch(/activates this connection today/i);
    expect(src).not.toContain('applyTransitFeedToSynastryBullets');
    expect(src).not.toContain('computeTransitAmplification');
    expect(src).toContain('DISCOVERY_BULLET_LABELS');
    expect(src).toContain('romantic_synastry');
  });
});
