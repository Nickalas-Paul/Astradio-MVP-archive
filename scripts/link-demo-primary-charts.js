/** Link usr_demo_* to chart_match_* in astradio_user_primary_chart (QA data repair). */
const { Client } = require('pg');
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const pairs = [
  ['usr_demo_1', 'chart_match_1'],
  ['usr_demo_2', 'chart_match_2'],
  ['usr_demo_3', 'chart_match_3'],
  ['usr_demo_4', 'chart_match_4'],
  ['usr_demo_5', 'chart_match_5'],
];
const client = new Client({
  connectionString: url,
  ssl: url && !url.includes('localhost') ? { rejectUnauthorized: false } : false,
});
(async () => {
  await client.connect();
  for (const [uid, cid] of pairs) {
    await client.query(
      `INSERT INTO astradio_user_primary_chart (user_id, chart_id, created_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET chart_id = EXCLUDED.chart_id`,
      [uid, cid]
    );
    console.log('linked', uid, '->', cid);
  }
  await client.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
