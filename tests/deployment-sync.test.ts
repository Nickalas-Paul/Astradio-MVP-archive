/**
 * Ensures deploy metadata and library-feed bullet system are wired for unified deployments.
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
    expect(getDeployMeta().bulletSystem).toBe('library-feed');
  });

  it('matches module does not ship legacy transit template helper', () => {
    const matchesPath = path.join(vnextRoot, 'compat', 'matches.js');
    expect(fs.existsSync(matchesPath)).toBe(true);
    const src = fs.readFileSync(matchesPath, 'utf8');
    expect(src).not.toMatch(/activates this connection today/i);
    expect(src).toContain('applyTransitFeedToSynastryBullets');
  });
});
