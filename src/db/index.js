// src/db/index.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },   // Railway always needs SSL
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected DB error:', err.message);
});

async function query(text, params) {
  const res = await pool.query(text, params);
  return res;
}

async function logActivity(userId, message, entityType = null, entityId = null) {
  try {
    await query(
      'INSERT INTO activity_log (user_id, message, entity_type, entity_id) VALUES ($1,$2,$3,$4)',
      [userId, message, entityType, entityId]
    );
  } catch (_) {}
}

module.exports = { pool, query, logActivity };

// Helper: log activity
async function logActivity(userId, message, entityType = null, entityId = null) {
  try {
    await query(
      'INSERT INTO activity_log (user_id, message, entity_type, entity_id) VALUES ($1,$2,$3,$4)',
      [userId, message, entityType, entityId]
    );
  } catch (_) {}
}

module.exports = { pool, query, logActivity };
