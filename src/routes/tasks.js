// src/routes/tasks.js
const router = require('express').Router();
const { body, param, query: qv } = require('express-validator');
const { query, logActivity } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.use(authenticate);

const TASK_SELECT = `
  SELECT
    t.*,
    p.name            AS project_name,
    a.name            AS assignee_name,
    a.avatar          AS assignee_avatar,
    a.color           AS assignee_color,
    c.name            AS created_by_name,
    CASE WHEN t.status != 'done' AND t.due_date < NOW() THEN true ELSE false END AS is_overdue
  FROM tasks t
  LEFT JOIN projects p ON p.id = t.project_id
  LEFT JOIN users a    ON a.id = t.assignee_id
  LEFT JOIN users c    ON c.id = t.created_by
`;

// GET /api/tasks — filterable task list
// ?status=todo|in-progress|done|overdue
// ?project_id=1
// ?assignee_id=1
// ?mine=true  (only tasks assigned to me or created by me)
router.get('/', async (req, res) => {
  try {
    const { status, project_id, assignee_id, mine, priority } = req.query;
    const conditions = [];
    const params = [];

    // Members see only their own tasks by default unless admin
    if (req.user.role !== 'admin' || mine === 'true') {
      params.push(req.user.id);
      conditions.push(`(t.assignee_id = $${params.length} OR t.created_by = $${params.length})`);
    }

    if (status === 'overdue') {
      conditions.push(`t.status != 'done' AND t.due_date < NOW()`);
    } else if (status) {
      params.push(status);
      conditions.push(`t.status = $${params.length}`);
    }

    if (project_id) {
      params.push(project_id);
      conditions.push(`t.project_id = $${params.length}`);
    }

    if (assignee_id) {
      params.push(assignee_id);
      conditions.push(`t.assignee_id = $${params.length}`);
    }

    if (priority) {
      params.push(priority);
      conditions.push(`t.priority = $${params.length}`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const result = await query(`${TASK_SELECT} ${where} ORDER BY t.created_at DESC`, params);
    res.json({ tasks: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// GET /api/tasks/stats — dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const params = isAdmin ? [] : [req.user.id];
    const filter = isAdmin ? '' : `WHERE t.assignee_id = $1 OR t.created_by = $1`;

    const result = await query(`
      SELECT
        COUNT(*)                                           AS total,
        COUNT(*) FILTER (WHERE t.status = 'done')          AS done,
        COUNT(*) FILTER (WHERE t.status = 'in-progress')   AS in_progress,
        COUNT(*) FILTER (WHERE t.status = 'todo')          AS todo,
        COUNT(*) FILTER (WHERE t.status != 'done' AND t.due_date < NOW()) AS overdue
      FROM tasks t ${filter}
    `, params);

    res.json({ stats: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/tasks/:id
router.get('/:id', param('id').isInt(), validate, async (req, res) => {
  try {
    const result = await query(`${TASK_SELECT} WHERE t.id = $1`, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Task not found' });

    const task = result.rows[0];
    // Members can only view tasks they're involved in
    if (req.user.role !== 'admin' && task.assignee_id !== req.user.id && task.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json({ task });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// POST /api/tasks
router.post('/',
  body('title').trim().notEmpty().isLength({ max: 300 }).withMessage('Title is required'),
  body('description').optional().trim(),
  body('project_id').optional().isInt(),
  body('assignee_id').optional().isInt(),
  body('priority').optional().isIn(['high', 'medium', 'low']),
  body('status').optional().isIn(['todo', 'in-progress', 'done']),
  body('due_date').optional().isISO8601(),
  validate,
  async (req, res) => {
    try {
      const { title, description = '', project_id = null, assignee_id = null,
              priority = 'medium', status = 'todo', due_date = null } = req.body;

      const result = await query(
        `INSERT INTO tasks (title, description, project_id, assignee_id, created_by, priority, status, due_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [title, description, project_id, assignee_id, req.user.id, priority, status, due_date]
      );
      const task = result.rows[0];
      await logActivity(req.user.id, `${req.user.name} created task "${title}"`, 'task', task.id);
      res.status(201).json({ task });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create task' });
    }
  }
);

// PATCH /api/tasks/:id
router.patch('/:id',
  param('id').isInt(),
  body('title').optional().trim().notEmpty().isLength({ max: 300 }),
  body('description').optional().trim(),
  body('project_id').optional().isInt(),
  body('assignee_id').optional().isInt(),
  body('priority').optional().isIn(['high', 'medium', 'low']),
  body('status').optional().isIn(['todo', 'in-progress', 'done']),
  body('due_date').optional().isISO8601(),
  validate,
  async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await query('SELECT * FROM tasks WHERE id = $1', [id]);
      if (!existing.rows.length) return res.status(404).json({ error: 'Task not found' });

      const t = existing.rows[0];
      // Only admin, task creator, or assignee can edit
      if (req.user.role !== 'admin' && t.created_by !== req.user.id && t.assignee_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const title       = req.body.title       ?? t.title;
      const description = req.body.description ?? t.description;
      const project_id  = req.body.project_id  !== undefined ? req.body.project_id  : t.project_id;
      const assignee_id = req.body.assignee_id !== undefined ? req.body.assignee_id : t.assignee_id;
      const priority    = req.body.priority    ?? t.priority;
      const status      = req.body.status      ?? t.status;
      const due_date    = req.body.due_date    !== undefined ? req.body.due_date    : t.due_date;

      const result = await query(
        `UPDATE tasks SET title=$1, description=$2, project_id=$3, assignee_id=$4,
         priority=$5, status=$6, due_date=$7 WHERE id=$8 RETURNING *`,
        [title, description, project_id, assignee_id, priority, status, due_date, id]
      );
      await logActivity(req.user.id, `${req.user.name} updated task "${title}"`, 'task', id);
      res.json({ task: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update task' });
    }
  }
);

// DELETE /api/tasks/:id — admin or task creator
router.delete('/:id', param('id').isInt(), validate, async (req, res) => {
  try {
    const existing = await query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Task not found' });

    const t = existing.rows[0];
    if (req.user.role !== 'admin' && t.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Only admins or the task creator can delete this task' });
    }

    await query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    await logActivity(req.user.id, `${req.user.name} deleted task "${t.title}"`, 'task', req.params.id);
    res.json({ message: 'Task deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;
