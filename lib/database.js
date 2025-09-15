const { Pool } = require('pg');
require('dotenv').config();

// Create connection pool
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
});

// Test the connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Utility function to run queries with error handling
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// Utility function to get a single row
async function getRow(text, params) {
  const res = await query(text, params);
  return res.rows[0] || null;
}

// Utility function to get multiple rows
async function getRows(text, params) {
  const res = await query(text, params);
  return res.rows;
}

// Utility function to insert and return the inserted row
async function insert(text, params) {
  const res = await query(text, params);
  return res.rows[0];
}

// Utility function to update and return the updated row
async function update(text, params) {
  const res = await query(text, params);
  return res.rows[0];
}

// Utility function to delete and return the deleted row
async function remove(text, params) {
  const res = await query(text, params);
  return res.rows[0];
}

// Close the pool (call this when shutting down the app)
async function close() {
  await pool.end();
}

module.exports = {
  pool,
  query,
  getRow,
  getRows,
  insert,
  update,
  remove,
  close
};
