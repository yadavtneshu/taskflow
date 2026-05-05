// src/db/seed.js — Populates demo data
const bcrypt = require('bcryptjs');
const { pool, query } = require('./index');

async function seed() {
  try {
    const hash = await bcrypt.hash('password', 10);

    // Users
    const adminRes = await query(`
      INSERT INTO users (name, email, password, role, avatar, color)
      VALUES ($1,$2,$3,'admin','AC','#7c6af5')
      ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name
      RETURNING id
    `, ['Alex Chen', 'admin@demo.com', hash]);

    const u2 = await query(`
      INSERT INTO users (name, email, password, role, avatar, color)
      VALUES ($1,$2,$3,'member','JL','#3ecf8e')
      ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name
      RETURNING id
    `, ['Jordan Lee', 'member@demo.com', hash]);

    const u3 = await query(`
      INSERT INTO users (name, email, password, role, avatar, color)
      VALUES ($1,$2,$3,'member','ST','#fbbf24')
      ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name
      RETURNING id
    `, ['Sam Torres', 'sam@demo.com', hash]);

    const u4 = await query(`
      INSERT INTO users (name, email, password, role, avatar, color)
      VALUES ($1,$2,$3,'member','MP','#f87171')
      ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name
      RETURNING id
    `, ['Maya Patel', 'maya@demo.com', hash]);

    const adminId = adminRes.rows[0].id;
    const jId = u2.rows[0].id;
    const sId = u3.rows[0].id;
    const mId = u4.rows[0].id;

    // Projects
    const p1 = await query(`
      INSERT INTO projects (name, description, status, due_date, created_by)
      VALUES ($1,$2,'active','2025-08-15',$3) RETURNING id
    `, ['Website Redesign', 'Full overhaul of the marketing site', adminId]);

    const p2 = await query(`
      INSERT INTO projects (name, description, status, due_date, created_by)
      VALUES ($1,$2,'active','2025-09-01',$3) RETURNING id
    `, ['Mobile App v2', 'Second version of the iOS/Android app', adminId]);

    const p3 = await query(`
      INSERT INTO projects (name, description, status, due_date, created_by)
      VALUES ($1,$2,'on-hold','2025-07-20',$3) RETURNING id
    `, ['API Integration', 'Connect to third-party payment providers', adminId]);

    const pid1 = p1.rows[0].id;
    const pid2 = p2.rows[0].id;
    const pid3 = p3.rows[0].id;

    // Tasks
    await query(`INSERT INTO tasks (title, description, project_id, assignee_id, created_by, priority, status, due_date)
      VALUES ($1,$2,$3,$4,$5,'high','done','2025-06-10')`,
      ['Design hero section', 'Create wireframes and hi-fi mockups', pid1, jId, adminId]);

    await query(`INSERT INTO tasks (title, description, project_id, assignee_id, created_by, priority, status, due_date)
      VALUES ($1,$2,$3,$4,$5,'medium','in-progress','2025-07-15')`,
      ['Write API docs', 'Document all public endpoints', pid3, sId, adminId]);

    await query(`INSERT INTO tasks (title, description, project_id, assignee_id, created_by, priority, status, due_date)
      VALUES ($1,$2,$3,$4,$5,'high','todo','2025-06-30')`,
      ['Setup CI/CD pipeline', 'GitHub Actions for automated deployment', pid2, mId, adminId]);

    await query(`INSERT INTO tasks (title, description, project_id, assignee_id, created_by, priority, status, due_date)
      VALUES ($1,$2,$3,$4,$5,'high','in-progress','2025-07-05')`,
      ['User auth flow', 'Login, signup, and password reset', pid2, jId, adminId]);

    await query(`INSERT INTO tasks (title, description, project_id, assignee_id, created_by, priority, status, due_date)
      VALUES ($1,$2,$3,$4,$5,'low','todo','2025-08-10')`,
      ['Content migration', 'Move blog posts to new CMS', pid1, sId, jId]);

    await query(`INSERT INTO tasks (title, description, project_id, assignee_id, created_by, priority, status, due_date)
      VALUES ($1,$2,$3,$4,$5,'medium','todo','2025-06-01')`,
      ['Performance audit', 'Lighthouse scoring and fixes', pid1, mId, adminId]);

    // Activity log
    await query(`INSERT INTO activity_log (user_id, message, entity_type, entity_id) VALUES
      ($1,'Created project "Website Redesign"','project',$2),
      ($1,'Task "Design hero section" marked as done','task',1),
      ($1,'Jordan Lee assigned to "User auth flow"','task',4)`,
      [adminId, pid1]);

    console.log('✅  Seed complete!');
    console.log('   admin@demo.com  / password  (Admin)');
    console.log('   member@demo.com / password  (Member)');
  } catch (err) {
    console.error('❌  Seed failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
