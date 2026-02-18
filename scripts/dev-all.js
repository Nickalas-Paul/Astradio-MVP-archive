#!/usr/bin/env node

/**
 * Astradio unified dev/start orchestrator.
 *
 * Modes:
 *   - dev   : backend (nodemon) + frontend (next dev)
 *   - prod  : backend (node)    + frontend (next start)
 *
 * Responsibilities:
 *   - Verify Node.js version against package.json engines
 *   - Ensure ports 3000 and 3001 are free
   *   - Start backend, wait for /health to be 200
 *   - Start frontend only after backend is healthy
 *   - Prefix logs with [backend] / [ui]
 *   - Clean shutdown on Ctrl+C
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');
const { spawn, execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PKG_PATH = path.join(ROOT, 'package.json');

const MODE = process.argv[2] === 'prod' ? 'prod' : 'dev';
const BACKEND_PORT = 3000;
const UI_PORT = 3001;
const HEALTH_PATH = '/health';
const HEALTH_TIMEOUT_MS = 30_000;

let backendProc = null;
let uiProc = null;

function logInfo(msg) {
  console.log(`[orchestrator] ${msg}`);
}

function logError(msg) {
  console.error(`[orchestrator] ERROR: ${msg}`);
}

/**
 * Read package.json engines.node and verify process.version satisfies it.
 * Supports simple ranges like ">=20.12.2".
 */
function checkNodeVersion() {
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
  } catch (e) {
    logError(`Failed to read package.json: ${e.message}`);
    process.exit(1);
  }

  const engines = pkg.engines || {};
  const req = engines.node;
  if (!req) {
    logInfo('No engines.node specified in package.json, skipping Node version check.');
    return;
  }

  const match = /^>=\s*([0-9]+)\.([0-9]+)\.([0-9]+)$/.exec(req.trim());
  if (!match) {
    logInfo(`engines.node is "${req}", unsupported format for strict check. Skipping.`);
    return;
  }

  const [ , minMajorStr, minMinorStr, minPatchStr ] = match;
  const [ curMajorStr, curMinorStr, curPatchStr ] = process.versions.node.split('.');

  const min = {
    major: parseInt(minMajorStr, 10),
    minor: parseInt(minMinorStr, 10),
    patch: parseInt(minPatchStr, 10),
  };
  const cur = {
    major: parseInt(curMajorStr, 10),
    minor: parseInt(curMinorStr, 10),
    patch: parseInt(curPatchStr, 10),
  };

  function isAtLeast(a, b) {
    if (a.major !== b.major) return a.major > b.major;
    if (a.minor !== b.minor) return a.minor > b.minor;
    return a.patch >= b.patch;
  }

  if (!isAtLeast(cur, min)) {
    logError(
      `Node.js version ${process.versions.node} does not satisfy engines.node "${req}".\n` +
      `Please install Node.js >= ${min.major}.${min.minor}.${min.patch}.`
    );
    process.exit(1);
  }

  logInfo(`Node.js version ${process.versions.node} satisfies engines.node "${req}".`);
}

/**
 * Check that a TCP port is free by trying to bind a temporary server.
 */
function ensurePortFree(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
      .once('error', (err) => {
        if (err.code === 'EADDRINUSE') reject(new Error(`EADDRINUSE:${port}`));
        else reject(err);
      })
      .once('listening', () => {
        server.close(() => resolve());
      })
      .listen(port, '0.0.0.0');
  });
}

/**
 * Kill processes listening on a port. Used when EADDRINUSE to free 3000/3001
 * before retrying (e.g. leftover dev-all backend/ui).
 */
function killProcessesOnPort(port) {
  const isWin = /^win/.test(process.platform);
  try {
    if (isWin) {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      const pids = new Set();
      for (const line of out.split(/\r?\n/)) {
        const m = line.trim().split(/\s+/);
        const pid = m[m.length - 1];
        if (/^\d+$/.test(pid)) pids.add(pid);
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'pipe' });
          logInfo(`Killed process ${pid} using port ${port}`);
        } catch (e) { /* ignore */ }
      }
    } else {
      const out = execSync(`lsof -ti :${port} 2>/dev/null || true`, { encoding: 'utf8' }).trim();
      if (out) {
        const pids = out.split(/\s+/).filter(Boolean);
        execSync(`kill -9 ${pids.join(' ')}`, { stdio: 'pipe' });
        logInfo(`Killed process(es) ${pids.join(', ')} using port ${port}`);
      }
    }
  } catch (e) {
    /* no processes found or not allowed */
  }
}

function runNpm(args, label) {
  // On Windows, npm is a batch file (.cmd) that needs shell execution
  // On Unix, npm is a script that can be executed directly
  const isWindows = /^win/.test(process.platform);
  
  let proc;
  if (isWindows) {
    // Windows: Use shell to run npm.cmd
    proc = spawn('npm.cmd', args, {
      cwd: ROOT,
      env: process.env,
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true, // Required for .cmd files on Windows
    });
  } else {
    // Unix: Direct execution
    proc = spawn('npm', args, {
      cwd: ROOT,
      env: process.env,
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: false,
    });
  }

  function pipe(stream, isErr) {
    stream.on('data', (chunk) => {
      const lines = chunk.toString().split(/\r?\n/);
      for (const line of lines) {
        if (!line.trim()) continue;
        const prefix = `[${label}]`;
        if (isErr) {
          console.error(`${prefix} ${line}`);
        } else {
          console.log(`${prefix} ${line}`);
        }
      }
    });
  }

  pipe(proc.stdout, false);
  pipe(proc.stderr, true);

  proc.on('exit', (code) => {
    logInfo(`${label} exited with code ${code}`);
    // If one process dies, shut down everything to avoid half-alive state.
    cleanup(code || 1);
  });

  return proc;
}

function waitForHealth(url, timeoutMs) {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    function attempt() {
      const req = http.get(url, (res) => {
        if (res.statusCode === 200) {
          res.resume();
          return resolve();
        }
        res.resume();
        if (Date.now() - start > timeoutMs) {
          return reject(new Error(`Backend health check did not return 200 within ${timeoutMs}ms (last status: ${res.statusCode}).`));
        }
        setTimeout(attempt, 1000);
      });

      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          return reject(new Error(`Backend health check failed to connect within ${timeoutMs}ms.`));
        }
        setTimeout(attempt, 1000);
      });
    }

    attempt();
  });
}

let shuttingDown = false;

function cleanup(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  logInfo('Shutting down processes...');

  const procs = [
    { p: backendProc, name: 'backend' },
    { p: uiProc, name: 'ui' },
  ];

  procs.forEach(({ p, name }) => {
    if (!p || p.killed) return;
    try {
      logInfo(`Stopping ${name}...`);
      p.kill('SIGINT');
    } catch (e) {
      logError(`Failed to stop ${name}: ${e.message}`);
    }
  });

  // Give children a moment to exit gracefully.
  setTimeout(() => {
    process.exit(exitCode);
  }, 500);
}

process.on('SIGINT', () => {
  logInfo('Received SIGINT (Ctrl+C).');
  cleanup(0);
});

process.on('SIGTERM', () => {
  logInfo('Received SIGTERM.');
  cleanup(0);
});

async function main() {
  logInfo(`Astradio unified startup (mode=${MODE})`);

  // 1) Preflight checks
  checkNodeVersion();

  logInfo(`Checking ports ${BACKEND_PORT} and ${UI_PORT} are free...`);
  try {
    await ensurePortFree(BACKEND_PORT);
    await ensurePortFree(UI_PORT);
  } catch (err) {
    const m = err.message || '';
    if (m.startsWith('EADDRINUSE:')) {
      const port = m.replace('EADDRINUSE:', '');
      logError(`Port ${port} is in use. Killing processes on ${BACKEND_PORT} and ${UI_PORT}...`);
      killProcessesOnPort(BACKEND_PORT);
      killProcessesOnPort(UI_PORT);
      await new Promise((r) => setTimeout(r, 1500));
      try {
        await ensurePortFree(BACKEND_PORT);
        await ensurePortFree(UI_PORT);
        logInfo('Ports freed. Proceeding.');
      } catch (e2) {
        logError(`Ports ${BACKEND_PORT} / ${UI_PORT} still in use after killing. Stop other Astradio/dev processes and retry.`);
        process.exit(1);
      }
    } else {
      logError(m);
      logError('Exiting due to port check failure.');
      process.exit(1);
    }
  }

  // 2) Start backend
  const backendScript = MODE === 'prod' ? 'start:backend' : 'dev:backend';
  logInfo(`Starting backend via "npm run ${backendScript}" on port ${BACKEND_PORT}...`);
  backendProc = runNpm(['run', backendScript], 'backend');

  // 3) Wait for backend health
  const healthUrl = `http://localhost:${BACKEND_PORT}${HEALTH_PATH}`;
  logInfo(`Waiting for backend health at ${healthUrl} (timeout ${HEALTH_TIMEOUT_MS}ms)...`);

  try {
    await waitForHealth(healthUrl, HEALTH_TIMEOUT_MS);
    logInfo('Backend is healthy (200 from /health).');
  } catch (err) {
    logError(err.message);
    logError('Backend failed to become healthy. Check [backend] logs above for details.');
    cleanup(1);
    return;
  }

  // 4) Start frontend
  const uiScript = MODE === 'prod' ? 'ui:start' : 'ui:dev';
  logInfo(`Starting frontend via "npm run ${uiScript}" on port ${UI_PORT}...`);
  uiProc = runNpm(['run', uiScript], 'ui');

  logInfo('Startup sequence complete. Services running:');
  logInfo(`  Backend:  http://localhost:${BACKEND_PORT}`);
  logInfo(`  Frontend: http://localhost:${UI_PORT}`);
  logInfo('Press Ctrl+C to stop both.');
}

main().catch((err) => {
  logError(`Fatal error in orchestrator: ${err.stack || err.message}`);
  cleanup(1);
});

