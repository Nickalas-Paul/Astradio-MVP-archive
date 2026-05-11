const { Client } = require('pg');
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const client = new Client({
  connectionString: url,
  ssl: url && !url.includes('localhost') ? { rejectUnauthorized: false } : false,
});
(async () => {
  await client.connect();
  const r = await client.query(
    `SELECT u.id, u.handle, u.display_name, u.bio, u.avatar_url, u.discoverable_as, u.looking_for,
            u.discoverable, u.show_in_feed,
            c.id AS chart_id, c.date, c.time, c.lat, c.lon, c.timezone
     FROM astradio_users u
     LEFT JOIN astradio_user_primary_chart p ON u.id = p.user_id
     LEFT JOIN astradio_charts c ON p.chart_id = c.id
     WHERE u.id = 'usr_demo_1'`
  );
  console.log(JSON.stringify(r.rows[0], null, 2));
  await client.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
