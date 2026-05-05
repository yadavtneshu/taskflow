// src/routes/users.js
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { body, param } = require('express-validator');
const { query, logActivity } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const COLORS = ['#7c6af5','#3ecf8e','#fbbf24','#f87171','#60a5fa','#f472b6'];

// All user routes require auth
router.use(authenticate);

// GET /api/users — list all users (any authenticated user can see team)
router.get('/', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, name, email, role, avatar, color, created_at FROM users ORDER BY created_at ASC'
    );
    // Attach task stats to each user
    const taskStats = await query(`
      SELECT assignee_id,
        COUNT(*)                                    AS total,
        COUNT(*) FILTER (WHERE status = 'done')     AS done,
        COUNT(*) FILTER (WHERE status = 'in-progress') AS in_progress
      FROM tasks GROUP BY assignee_id
    `);
    const statsMap = {};
    taskStats.rows.forEach(r => { statsMap[r.assignee_id] = r; });

    const users = result.rows.map(u => ({
      ...u,
      taskStats: statsMap[u.id] || { total: 0, done: 0, in_progress: 0 }
    }));
    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/users — admin invites a new member
router.post('/',
  requireAdmin,
  body('name').trim().notEmpty().isLength({ max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('role').optional().isIn(['admin', 'member']),
  validate,
  async (req, res) => {
    try {
      const { name, email, role = 'member' } = req.body;
      const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length) return res.status(409).json({ error: 'Email already exists' });

      const hash = await bcrypt.hash('welcome123', 10);
      const avatar = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
      const countRes = await query('SELECT COUNT(*) FROM users');
      const color = COLORS[parseInt(countRes.rows[0].count) % COLORS.length];

      const result = await query(
        'INSERT INTO users (name, email, password, role, avatar, color) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, email, role, avatar, color',
        [name, email, hash, role, avatar, color]
      );
      const user = result.rows[0];
      await logActivity(req.user.id, `${req.user.name} invited "${name}" as ${role}`, 'user', user.id);
      res.status(201).json({ user, defaultPassword: 'welcome123' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create user' });
    }
  }
);

// PATCH /api/users/:id/role — admin changes a user's role
router.patch('/:id/role',
  requireAdmin,
  param('id').isInt(),
  body('role').isIn(['admin', 'member']),
  validate,
  async (req, res) => {
    try {
      const { id } = req.params;
      if (parseInt(id) === req.user.id) return res.status(400).json({ error: "Can't change your own role" });

      const result = await query(
        'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role, avatar, color',
        [req.body.role, id]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
      const user = result.rows[0];
      await logActivity(req.user.id, `${req.user.name} changed ${user.name}'s role to ${user.role}`, 'user', user.id);
      res.json({ user });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update role' });
    }
  }
);

// DELETE /api/users/:id — admin removes a user
router.delete('/:id',
  requireAdmin,
  param('id').isInt(),
  validate,
  async (req, res) => {
    try {
      const { id } = req.params;
      if (parseInt(id) === req.user.id) return res.status(400).json({ error: "Can't delete yourself" });

      const result = await query('DELETE FROM users WHERE id = $1 RETURNING name', [id]);
      if (!result.rows.length) return res.status(404).json({ error: 'User not found' });

      await logActivity(req.user.id, `${req.user.name} removed user "${result.rows[0].name}"`, 'user', id);
      res.json({ message: 'User removed' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  }
);

module.exports = router;
