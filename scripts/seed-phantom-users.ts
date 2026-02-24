import * as fs from 'fs';
import * as path from 'path';
import * as pgStore from '../lib/pg-store';

type PhantomRecord = {
  userId: string;
  chartId: string;
};

async function main(): Promise<void> {
  if (!process.env.POSTGRES_URL) {
    console.error('[seed-phantom-users] POSTGRES_URL is required for pg-store.');
    process.exit(1);
  }

  const rawCount = process.argv[2] ?? process.env.PHANTOM_COUNT ?? '10';
  const count = Number.parseInt(rawCount, 10);
  if (!Number.isFinite(count) || count <= 0) {
    console.error('[seed-phantom-users] Invalid count. Provide a positive integer as argv[2] or PHANTOM_COUNT.');
    process.exit(1);
  }

  const records: PhantomRecord[] = [];

  console.log(`[seed-phantom-users] Seeding ${count} phantom users and charts...`);

  for (let i = 0; i < count; i++) {
    const idx = i + 1;
    const displayName = `Phantom User ${idx}`;
    const label = `Phantom Natal ${idx}`;

    // createUser / createChart / setUserPrimaryChart are provided by pg-store.
    // Types are inferred as any from the JS module; this script is intended for
    // operational seeding, not as part of the core runtime.
    const user = await (pgStore as any).createUser({
      displayName,
    });

    const chart = await (pgStore as any).createChart({
      ownerId: user.id,
      label,
      date: '1990-01-15',
      time: '12:00',
      lat: 40.7128,
      lon: -74.006,
      timezone: undefined,
      snapshotHash: null,
    });

    await (pgStore as any).setUserPrimaryChart(user.id, chart.id);

    records.push({ userId: user.id, chartId: chart.id });
    console.log(`[seed-phantom-users] Created user=${user.id} chart=${chart.id}`);
  }

  const outPath =
    process.env.PHANTOM_OUTPUT ||
    path.join(process.cwd(), 'artifacts', 'phantom-users.json');

  const outDir = path.dirname(outPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const payload = {
    count,
    createdAt: new Date().toISOString(),
    records,
  };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');

  console.log('[seed-phantom-users] Done.');
  console.log('[seed-phantom-users] Output written to', outPath);
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed-phantom-users] Failed:', err);
  process.exit(1);
});

