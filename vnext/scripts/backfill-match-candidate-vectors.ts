import { setStorage } from '../compat/storage';
import { ensureSeedCandidateVectors } from '../compat/seed-vectors';

async function main(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dotenv = require('dotenv');
  dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });

  if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL is required for match candidate vector backfill');
  }

  // Path from compiled dist/vnext/vnext/scripts/ -> repo root lib
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pgStore = require('../../../../lib/pg-store');
  setStorage(pgStore);

  const results = await ensureSeedCandidateVectors();
  console.log(
    JSON.stringify(
      {
        total: results.length,
        regenerated: results.filter((result) => result.status === 'regenerated').map((result) => result.chartId),
        candidates: results,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error('[backfill-match-candidate-vectors]', error);
  process.exit(1);
});
