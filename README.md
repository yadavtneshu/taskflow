# ⚡ TaskFlow — Team Task Manager

A full-stack team task management web app with role-based access control (Admin / Member), project tracking, task assignment, and a live dashboard.

![Node.js](https://img.shields.io/badge/Node.js-20-green?logo=node.js)
![Express](https://img.shields.io/badge/Express-4.x-black?logo=express)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue?logo=postgresql)
![Railway](https://img.shields.io/badge/Deploy-Railway-purple?logo=railway)

---

## 🚀 Live Demo

> **URL:** `https://taskflow-production.up.railway.app`
> **Admin:** `admin@demo.com` / `password`
> **Member:** `member@demo.com` / `password`

---

## ✨ Features

| Feature | Details |
|---|---|
| 🔐 Authentication | JWT-based signup / login, 7-day token expiry |
| 👥 Role-Based Access | Admin: full control · Member: own tasks only |
| 📁 Projects | Create, edit, delete projects with progress tracking |
| ✅ Tasks | Full CRUD, priority levels, status, due dates, assignee |
| 📊 Dashboard | Live stats: total / in-progress / done / overdue |
| 🗂 Kanban View | Per-project board (To Do → In Progress → Done) |
| 👤 Team Management | Invite members, change roles, remove users (Admin) |
| 📋 Activity Log | Audit trail of all actions (Admin only) |
| ⚠️ Overdue Detection | Auto-flagged tasks past due date |
| 🐳 Docker | Multi-stage Dockerfile + docker-compose for local dev |

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 |
| Framework | Express 4 |
| Database | PostgreSQL 16 |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Validation | express-validator |
| Security | helmet, cors |
| Frontend | Vanilla JS SPA (zero build step) |
| Deployment | Railway (Docker) |

---

## 📁 Project Structure

```
taskflow/
├── public/
│   └── index.html          # Frontend SPA — talks to REST API
├── src/
│   ├── index.js            # Express app entry point
│   ├── db/
│   │   ├── index.js        # pg Pool + query helper + logActivity
│   │   ├── migrate.js      # Creates all tables + triggers
│   │   └── seed.js         # Demo data (4 users, 3 projects, 6 tasks)
│   ├── middleware/
│   │   ├── auth.js         # JWT verify · requireAdmin · requireAdminOrSelf
│   │   └── validate.js     # express-validator error handler
│   └── routes/
│       ├── auth.js         # POST /signup  POST /login  GET /me
│       ├── users.js        # GET / POST / PATCH /:id/role / DELETE /:id
│       ├── projects.js     # Full CRUD (admin write, all read)
│       ├── tasks.js        # Full CRUD + stats + filtering
│       └── activity.js     # GET /activity (admin only)
├── startup.js              # Auto-migrate then start server
├── Dockerfile              # Multi-stage production image
├── docker-compose.yml      # Local dev: app + postgres
├── railway.toml            # Railway deployment config
├── Procfile                # Heroku/Railway fallback
├── .env.example            # Environment variable template
└── package.json
```

---

## ⚙️ Local Setup (without Docker)

### Prerequisites
- Node.js ≥ 18
- PostgreSQL running locally

### 1. Clone & install
```bash
git clone https://github.com/YOUR_USERNAME/taskflow.git
cd taskflow
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env — set your DATABASE_URL and JWT_SECRET
```

### 3. Set up the database
```bash
# Create the database
createdb taskflow

# Run migrations (creates tables)
npm run migrate

# Seed demo data
npm run seed
```

### 4. Start the server
```bash
npm run dev       # development (nodemon)
npm start         # production
```

Open **http://localhost:3000**

---

## 🐳 Local Setup (with Docker)

```bash
# Start PostgreSQL + app (auto-migrates on first boot)
docker compose up -d

# Seed demo data
docker compose exec app node src/db/seed.js

# View logs
docker compose logs -f app
```

Open **http://localhost:3000**

---

## 🌐 Deploy to Railway

### Option A — GitHub (recommended)

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub**
3. Select your repo
4. Add a **PostgreSQL** service from the Railway dashboard
5. Set these environment variables in Railway:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | *(generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`)* |
| `DATABASE_URL` | *(auto-filled by Railway Postgres plugin)* |

6. Railway auto-detects `railway.toml` and builds the Dockerfile
7. After deploy, run the seed (one-time):
```bash
railway run node src/db/seed.js
```

### Option B — Railway CLI

```bash
npm install -g @railway/cli
railway login
railway init
railway add --database postgresql
railway up
railway run node src/db/seed.js
```

---

## 📡 REST API Reference

All protected routes require:
```
Authorization: Bearer <jwt_token>
```

### Auth

| Method | Endpoint | Auth | Body | Description |
|---|---|---|---|---|
| `POST` | `/api/auth/signup` | ❌ | `name, email, password, role?` | Register |
| `POST` | `/api/auth/login` | ❌ | `email, password` | Login → returns token |
| `GET` | `/api/auth/me` | ✅ | — | Current user info |

### Users

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/api/users` | ✅ | Any | List all users + task stats |
| `POST` | `/api/users` | ✅ | Admin | Invite member (default pw: `welcome123`) |
| `PATCH` | `/api/users/:id/role` | ✅ | Admin | Change role (admin ↔ member) |
| `DELETE` | `/api/users/:id` | ✅ | Admin | Remove user |

### Projects

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/api/projects` | ✅ | Any | List all + task counts |
| `GET` | `/api/projects/:id` | ✅ | Any | Project + all its tasks |
| `POST` | `/api/projects` | ✅ | Admin | Create project |
| `PATCH` | `/api/projects/:id` | ✅ | Admin | Update project |
| `DELETE` | `/api/projects/:id` | ✅ | Admin | Delete project |

### Tasks

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/api/tasks` | ✅ | Any | List tasks (members see own only) |
| `GET` | `/api/tasks/stats` | ✅ | Any | Dashboard stats |
| `GET` | `/api/tasks/:id` | ✅ | Any | Single task |
| `POST` | `/api/tasks` | ✅ | Any | Create task |
| `PATCH` | `/api/tasks/:id` | ✅ | Any* | Update task |
| `DELETE` | `/api/tasks/:id` | ✅ | Any* | Delete task |

*Members can only edit/delete their own tasks (created_by or assignee).

**Query params for `GET /api/tasks`:**
- `?status=todo|in-progress|done|overdue`
- `?project_id=1`
- `?assignee_id=2`
- `?mine=true` — only tasks you created or are assigned to
- `?priority=high|medium|low`

### Activity (Admin only)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/activity?limit=50&offset=0` | Paginated audit log |

---

## 🗄 Database Schema

```sql
users          — id, name, email, password, role, avatar, color, created_at
projects       — id, name, description, status, due_date, created_by, created_at, updated_at
project_members— project_id, user_id  (many-to-many)
tasks          — id, title, description, project_id, assignee_id, created_by,
                 priority, status, due_date, created_at, updated_at
activity_log   — id, user_id, message, entity_type, entity_id, created_at
```

Triggers auto-update `updated_at` on `projects` and `tasks`.

---

## 🔐 RBAC Summary

| Action | Admin | Member |
|---|---|---|
| View all projects & tasks | ✅ | ✅ |
| Create tasks | ✅ | ✅ |
| Edit own tasks | ✅ | ✅ |
| Edit any task | ✅ | ❌ |
| Delete own tasks | ✅ | ✅ |
| Delete any task | ✅ | ❌ |
| Create / Edit / Delete projects | ✅ | ❌ |
| Invite members | ✅ | ❌ |
| Change user roles | ✅ | ❌ |
| Remove users | ✅ | ❌ |
| View activity log | ✅ | ❌ |

---

## 🧪 Testing the API (curl examples)

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"password"}'

# Create a task (replace TOKEN)
curl -X POST http://localhost:3000/api/tasks \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Fix login bug","priority":"high","status":"todo"}'

# Get all tasks
curl http://localhost:3000/api/tasks \
  -H "Authorization: Bearer TOKEN"

# Get dashboard stats
curl http://localhost:3000/api/tasks/stats \
  -H "Authorization: Bearer TOKEN"
```

---

## 📝 License

MIT — free to use, modify, and deploy.
