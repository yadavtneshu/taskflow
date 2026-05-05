// src/db/migrate.js — Run once to create all tables
const { pool } = require('./index');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(100) NOT NULL,
        email       VARCHAR(255) UNIQUE NOT NULL,
        password    VARCHAR(255) NOT NULL,
        role        VARCHAR(20)  NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
        avatar      VARCHAR(10),
        color       VARCHAR(20)  DEFAULT '#7c6af5',
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(200) NOT NULL,
        description TEXT,
        status      VARCHAR(20)  NOT NULL DEFAULT 'active' CHECK (status IN ('active','on-hold','completed')),
        due_date    DATE,
        created_by  INTEGER      REFERENCES users(id) ON DELETE SET NULL,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS project_members (
        project_id  INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (project_id, user_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id          SERIAL PRIMARY KEY,
        title       VARCHAR(300) NOT NULL,
        description TEXT,
        project_id  INTEGER      REFERENCES projects(id) ON DELETE SET NULL,
        assignee_id INTEGER      REFERENCES users(id) ON DELETE SET NULL,
        created_by  INTEGER      REFERENCES users(id) ON DELETE SET NULL,
        priority    VARCHAR(10)  NOT NULL DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
        status      VARCHAR(20)  NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in-progress','done')),
        due_date    DATE,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER      REFERENCES users(id) ON DELETE SET NULL,
        message     TEXT         NOT NULL,
        entity_type VARCHAR(50),
        entity_id   INTEGER,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `);

    // Auto-update updated_at trigger
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
      $$ LANGUAGE plpgsql;
    `);

    for (const tbl of ['projects', 'tasks']) {
      await client.query(`
        DROP TRIGGER IF EXISTS trg_${tbl}_updated_at ON ${tbl};
        CREATE TRIGGER trg_${tbl}_updated_at
          BEFORE UPDATE ON ${tbl}
          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
      `);
    }

    await client.query('COMMIT');
    console.log('✅  Migration complete — all tables created.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌  Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
