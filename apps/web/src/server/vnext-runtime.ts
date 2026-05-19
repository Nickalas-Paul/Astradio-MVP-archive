/**
 * Boot vnext compat storage and load compiled handlers for in-process API routes on Vercel.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

let compatBooted = false;

function resolveVnextRoot(): string {
  const candidates = [
    path.join(process.cwd(), 'dist', 'vnext', 'vnext'),
    path.join(process.cwd(), '..', '..', 'dist', 'vnext', 'vnext'),
    path.join(process.cwd(), '../../dist/vnext/vnext'),
  ];
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, 'compat', 'matches.js'))) {
      return root;
    }
  }
  throw new Error(
    'vnext dist not found (run npm run vnext:build from repo root). Tried: ' + candidates.join(', ')
  );
}

export function getVnextRoot(): string {
  return resolveVnextRoot();
}

/** One-time compat storage wiring (mirrors server/index.js compat boot). */
export function ensureVnextCompatBoot(): void {
  if (compatBooted) return;

  const vnextRoot = getVnextRoot();
  const repoRoot = path.join(vnextRoot, '..', '..', '..');
  try {
    const requireRepo = createRequire(path.join(repoRoot, 'package.json'));
    const gcp = requireRepo('./lib/gcp-credentials') as { loadGcpCredentials?: () => void };
    gcp.loadGcpCredentials?.();
  } catch {
    /* optional */
  }

  const requireCompat = createRequire(path.join(vnextRoot, 'compat', 'storage.js'));
  const compatStorage = requireCompat('./storage') as { setStorage?: (s: unknown) => void };
  const requireRepo = createRequire(path.join(repoRoot, 'package.json'));
  const pgStore = process.env.POSTGRES_URL ? requireRepo('./lib/pg-store') : null;
  const memStore = createRequire(path.join(vnextRoot, 'compat', 'memory-store.js'))('.');
  const store = pgStore || memStore;

  if (compatStorage?.setStorage && store) {
    compatStorage.setStorage(store);
  }

  compatBooted = true;
}

export type CompatMatchesModule = {
  getCompatMatches: (
    chartId: string,
    mode: string,
    limit: number,
    options?: { includeTransits?: boolean }
  ) => Promise<unknown[]>;
  toPublicCompatMatch: (match: unknown) => unknown;
};

export function loadCompatMatchesModule(): CompatMatchesModule {
  ensureVnextCompatBoot();
  const vnextRoot = getVnextRoot();
  const requireMatches = createRequire(path.join(vnextRoot, 'compat', 'matches.js'));
  return requireMatches('.') as CompatMatchesModule;
}

export function loadDeployMetaModule(): {
  getDeployMeta: () => {
    commit: string;
    branch: string;
    deployTarget: string;
    bulletSystem: string;
    timestamp: string;
  };
} {
  const vnextRoot = getVnextRoot();
  const requireMeta = createRequire(path.join(vnextRoot, 'deploy-meta.js'));
  return requireMeta('.') as {
    getDeployMeta: () => {
      commit: string;
      branch: string;
      deployTarget: string;
      bulletSystem: string;
      timestamp: string;
    };
  };
}
