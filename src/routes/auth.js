// src/routes/auth.js
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const { query, logActivity } = require('../db');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const COLORS = ['#7c6af5','#3ecf8e','#fbbf24','#f87171','#60a5fa','#f472b6'];

// POST /api/auth/signup
router.post('/signup',
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['admin', 'member']).withMessage('Role must be admin or member'),
  validate,
  async (req, res) => {
    try {
      const { name, email, password, role = 'member' } = req.body;

      const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length) return res.status(409).json({ error: 'Email already registered' });

      const hash = await bcrypt.hash(password, 10);
      const avatar = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

      const countRes = await query('SELECT COUNT(*) FROM users');
      const color = COLORS[parseInt(countRes.rows[0].count) % COLORS.length];

      const result = await query(
        'INSERT INTO users (name, email, password, role, avatar, color) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, email, role, avatar, color',
        [name, email, hash, role, avatar, color]
      );

      const user = result.rows[0];
      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
      await logActivity(user.id, `${name} signed up as ${role}`, 'user', user.id);

      res.status(201).json({ token, user });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Signup failed' });
    }
  }
);

// POST /api/auth/login
router.post('/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  validate,
  async (req, res) => {
    try {
      const { email, password } = req.body;
      const result = await query('SELECT * FROM users WHERE email = $1', [email]);
      const user = result.rows[0];

      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
      const { password: _, ...safeUser } = user;

      await logActivity(user.id, `${user.name} logged in`, 'user', user.id);
      res.json({ token, user: safeUser });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// GET /api/auth/me — get current user
router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
