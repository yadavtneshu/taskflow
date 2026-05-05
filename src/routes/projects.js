// src/routes/projects.js
const router = require('express').Router();
const { body, param } = require('express-validator');
const { query, logActivity } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.use(authenticate);

// GET /api/projects — all projects with task counts and progress
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        p.*,
        u.name AS created_by_name,
        COUNT(t.id)                                    AS task_count,
        COUNT(t.id) FILTER (WHERE t.status = 'done')   AS done_count,
        COUNT(t.id) FILTER (WHERE t.status = 'in-progress') AS in_progress_count
      FROM projects p
      LEFT JOIN users u ON u.id = p.created_by
      LEFT JOIN tasks t ON t.project_id = p.id
      GROUP BY p.id, u.name
      ORDER BY p.created_at DESC
    `);
    res.json({ projects: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// GET /api/projects/:id — single project with its tasks
router.get('/:id', param('id').isInt(), validate, async (req, res) => {
  try {
    const pRes = await query(`
      SELECT p.*, u.name AS created_by_name
      FROM projects p
      LEFT JOIN users u ON u.id = p.created_by
      WHERE p.id = $1
    `, [req.params.id]);

    if (!pRes.rows.length) return res.status(404).json({ error: 'Project not found' });

    const tRes = await query(`
      SELECT t.*, u.name AS assignee_name, u.avatar AS assignee_avatar, u.color AS assignee_color
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assignee_id
      WHERE t.project_id = $1
      ORDER BY t.created_at DESC
    `, [req.params.id]);

    res.json({ project: pRes.rows[0], tasks: tRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// POST /api/projects — admin only
router.post('/',
  requireAdmin,
  body('name').trim().notEmpty().isLength({ max: 200 }).withMessage('Name is required'),
  body('description').optional().trim(),
  body('status').optional().isIn(['active', 'on-hold', 'completed']),
  body('due_date').optional().isISO8601(),
  validate,
  async (req, res) => {
    try {
      const { name, description = '', status = 'active', due_date = null } = req.body;
      const result = await query(
        'INSERT INTO projects (name, description, status, due_date, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *',
        [name, description, status, due_date, req.user.id]
      );
      const project = result.rows[0];
      await logActivity(req.user.id, `${req.user.name} created project "${name}"`, 'project', project.id);
      res.status(201).json({ project });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create project' });
    }
  }
);

// PATCH /api/projects/:id — admin only
router.patch('/:id',
  requireAdmin,
  param('id').isInt(),
  body('name').optional().trim().notEmpty().isLength({ max: 200 }),
  body('description').optional().trim(),
  body('status').optional().isIn(['active', 'on-hold', 'completed']),
  body('due_date').optional().isISO8601(),
  validate,
  async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await query('SELECT * FROM projects WHERE id = $1', [id]);
      if (!existing.rows.length) return res.status(404).json({ error: 'Project not found' });

      const p = existing.rows[0];
      const name = req.body.name ?? p.name;
      const description = req.body.description ?? p.description;
      const status = req.body.status ?? p.status;
      const due_date = req.body.due_date ?? p.due_date;

      const result = await query(
        'UPDATE projects SET name=$1, description=$2, status=$3, due_date=$4 WHERE id=$5 RETURNING *',
        [name, description, status, due_date, id]
      );
      await logActivity(req.user.id, `${req.user.name} updated project "${name}"`, 'project', id);
      res.json({ project: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update project' });
    }
  }
);

// DELETE /api/projects/:id — admin only
router.delete('/:id',
  requireAdmin,
  param('id').isInt(),
  validate,
  async (req, res) => {
    try {
      const result = await query('DELETE FROM projects WHERE id = $1 RETURNING name', [req.params.id]);
      if (!result.rows.length) return res.status(404).json({ error: 'Project not found' });
      await logActivity(req.user.id, `${req.user.name} deleted project "${result.rows[0].name}"`, 'project', req.params.id);
      res.json({ message: 'Project deleted' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete project' });
    }
  }
);

module.exports = router;
