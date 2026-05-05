require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  console.log('='.repeat(50));
  console.log('⚡ TaskFlow Starting...');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('DATABASE_URL set:', !!dbUrl);
  console.log('='.repeat(50));

  if (!dbUrl) {
    console.error('❌ FATAL: DATABASE_URL is not set!');
    process.exit(1);
  }

  // Try SSL first (Railway requires it), fallback without
  let pool;
  let usedSSL = true;
  try {
    pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
    await pool.query('SELECT 1');
    console.log('✅ Database connected (SSL)');
  } catch (sslErr) {
    console.log('SSL failed:', sslErr.message);
    usedSSL = false;
    try {
      if (pool) await pool.end().catch(() => {});
      pool = new Pool({ connectionString: dbUrl, ssl: false, connectionTimeoutMillis: 10000 });
      await pool.query('SELECT 1');
      console.log('✅ Database connected (no SSL)');
    } catch (err) {
      console.error('❌ Cannot connect to database:', err.message);
      process.exit(1);
    }
  }

  // Inline migration
  console.log('🔄 Running migration...');
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'member', avatar VARCHAR(10),
        color VARCHAR(20) DEFAULT '#7c6af5', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY, name VARCHAR(200) NOT NULL, description TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'active', due_date DATE, created_by INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS project_members (project_id INTEGER, user_id INTEGER, PRIMARY KEY (project_id, user_id));
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY, title VARCHAR(300) NOT NULL, description TEXT,
        project_id INTEGER, assignee_id INTEGER, created_by INTEGER,
        priority VARCHAR(10) NOT NULL DEFAULT 'medium', status VARCHAR(20) NOT NULL DEFAULT 'todo',
        due_date DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS activity_log (
        id SERIAL PRIMARY KEY, user_id INTEGER, message TEXT NOT NULL,
        entity_type VARCHAR(50), entity_id INTEGER, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✅ Tables ready');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }

  // Seed if empty
  try {
    const { rows } = await pool.query('SELECT COUNT(*) FROM users');
    if (parseInt(rows[0].count) === 0) {
      console.log('🌱 Seeding demo data...');
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash('password', 10);
      const u1 = await pool.query(`INSERT INTO users (name,email,password,role,avatar,color) VALUES ('Alex Chen','admin@demo.com',$1,'admin','AC','#7c6af5') RETURNING id`, [hash]);
      const u2 = await pool.query(`INSERT INTO users (name,email,password,role,avatar,color) VALUES ('Jordan Lee','member@demo.com',$1,'member','JL','#3ecf8e') RETURNING id`, [hash]);
      const u3 = await pool.query(`INSERT INTO users (name,email,password,role,avatar,color) VALUES ('Sam Torres','sam@demo.com',$1,'member','ST','#fbbf24') RETURNING id`, [hash]);
      const aid = u1.rows[0].id; const jid = u2.rows[0].id; const sid = u3.rows[0].id;
      const p1 = await pool.query(`INSERT INTO projects (name,description,status,due_date,created_by) VALUES ('Website Redesign','Full site overhaul','active','2025-08-15',$1) RETURNING id`, [aid]);
      const p2 = await pool.query(`INSERT INTO projects (name,description,status,due_date,created_by) VALUES ('Mobile App v2','iOS/Android app','active','2025-09-01',$1) RETURNING id`, [aid]);
      await pool.query(`INSERT INTO tasks (title,project_id,assignee_id,created_by,priority,status,due_date) VALUES ('Design hero section',$1,$2,$3,'high','done','2025-06-10')`, [p1.rows[0].id, jid, aid]);
      await pool.query(`INSERT INTO tasks (title,project_id,assignee_id,created_by,priority,status,due_date) VALUES ('User auth flow',$1,$2,$3,'high','in-progress','2025-07-05')`, [p2.rows[0].id, jid, aid]);
      await pool.query(`INSERT INTO tasks (title,project_id,assignee_id,created_by,priority,status,due_date) VALUES ('Content migration',$1,$2,$3,'medium','todo','2025-08-10')`, [p1.rows[0].id, sid, aid]);
      console.log('✅ Seeded! Login: admin@demo.com / password');
    } else {
      console.log('ℹ️  Data exists, skipping seed');
    }
  } catch (err) {
    console.log('⚠️  Seed skipped:', err.message);
  }

  await pool.end();
  console.log('🚀 Starting server...');
  require('./src/index.js');
}

main().catch(err => { console.error('💥 Crash:', err.message); process.exit(1); });
