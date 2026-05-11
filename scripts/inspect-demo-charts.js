const { Client } = require('pg');
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const client = new Client({
  connectionString: url,
  ssl: url && !url.includes('localhost') ? { rejectUnauthorized: false } : false,
});
(async () => {
  await client.connect();
  const charts = await client.query(
    `SELECT id, owner_id, label FROM astradio_charts WHERE id LIKE 'chart_match%' OR owner_id LIKE 'usr_demo_%' ORDER BY id`
  );
  console.log('charts:');
  console.table(charts.rows);
  const pc = await client.query(
    `SELECT * FROM astradio_user_primary_chart WHERE user_id LIKE 'usr_demo_%'`
  );
  console.log('primary links:');
  console.table(pc.rows);
  await client.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
