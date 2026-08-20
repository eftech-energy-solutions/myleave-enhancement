# Local Database Setup Guide

This guide walks you through setting up a local PostgreSQL database using Docker, replacing the cloud-hosted Neon DB for development.

---

## Prerequisites

| Requirement | Check Command | Install |
|-------------|---------------|---------|
| Docker Desktop | `docker --version` | [docker.com](https://docs.docker.com/get-docker/) |
| Node.js 18+ | `node --version` | [nodejs.org](https://nodejs.org/) |

---

## Quick Start (5 steps)

```bash
# 1. Start the database container
cd backend
npm run db:up

# 2. Wait ~5 seconds for PostgreSQL to initialize, then seed the admin
npm run db:seed

# 3. Start the app as normal
cd ..
npm run dev
```

Login with:
- **Email:** `admin@eftech.com.my`
- **Password:** `Admin@123!`

---

## Step-by-Step Setup

### Step 1 — Start the Docker Container

From the `backend/` directory:

```bash
npm run db:up
```

This pulls `postgres:16-alpine` on first run and starts a container named `myleave-db` on port **5434**.

Verify it's running:

```bash
docker ps --filter "name=myleave-db"
```

You should see:

```
NAMES       STATUS
myleave-db  Up (healthy)
```

The database is created automatically with these credentials:

| Field | Value |
|-------|-------|
| Host | `127.0.0.1` |
| Port | `5434` |
| Database | `myleave` |
| User | `myleave` |
| Password | `myleave123` |

> **Why port 5434?** Your system already has PostgreSQL 18 running on port 5433. The Docker container uses 5434 to avoid the conflict.

### Step 2 — Seed the Admin User

```bash
npm run db:seed
```

Output:

```
Connecting to local PostgreSQL...
Connected.

Admin user created successfully!

  Staff ID:   E0001
  Full Name:  System Administrator
  Email:      admin@eftech.com.my
  Role:       Admin
  Password:   Admin@123!

  Leave Entitlements seeded: HOSP(60), MAT(98), PAT(7), COMP_A(3), COMP_B(1), MAR(3)
  Role override set in role_setting table.
```

#### Custom Admin Credentials

```bash
node db/seed-admin.js --email=you@company.com --password=YourPass --staff-id=E9999
```

| Flag | Default | Description |
|------|---------|-------------|
| `--email` | `admin@eftech.com.my` | Admin login email |
| `--password` | `Admin@123!` | Admin login password |
| `--staff-id` | `E0001` | Employee code |

The seeder skips if the email already exists.

### Step 3 — Verify the Schema

All 8 tables are created on first container start via `backend/db/schema.sql`:

```bash
docker exec myleave-db psql -U myleave -d myleave -c "\dt"
```

Expected output:

```
               List of relations
 Schema |        Name        | Type  |  Owner
--------+--------------------+-------+---------
 public | admin_logs         | table | myleave
 public | holiday_overrides  | table | myleave
 public | leave_entitlements | table | myleave
 public | leave_requests     | table | myleave
 public | password_resets    | table | myleave
 public | profiles           | table | myleave
 public | public_holidays    | table | myleave
 public | role_setting       | table | myleave
```

Verify the admin user:

```bash
docker exec myleave-db psql -U myleave -d myleave -c "SELECT staff_id, email, role FROM profiles;"
```

### Step 4 — Start the Application

```bash
# From the project root
npm run dev
```

This starts both the backend (port 5000) and frontend (port 5173) via `concurrently`.

### Step 5 — Login

Open `http://localhost:5173/login` and use the admin credentials.

---

## All DB Scripts

Run these from the `backend/` directory:

| Command | Description |
|---------|-------------|
| `npm run db:up` | Start the Docker PostgreSQL container |
| `npm run db:down` | Stop and remove the container (data persists in Docker volume) |
| `npm run db:logs` | Tail the container logs |
| `npm run db:seed` | Create an admin user (skips if already exists) |
| `npm run db:reset` | **Nuke everything** — destroys volume, recreates DB, re-runs schema, re-seeds admin |

---

## Architecture

```
backend/db/
├── docker-compose.yml    # Container definition (PostgreSQL 16 Alpine)
├── schema.sql            # Full schema — runs on first container start
└── seed-admin.js         # Node.js script to create admin user

backend/src/db.js         # Connection pool — reads DATABASE_URL from .env
.env                      # Local DB connection string (already configured)
.env.example              # Template with local + production options
```

### How It Connects

1. `db.js` reads `DATABASE_URL` from `.env`
2. Connection string points to `postgresql://myleave:myleave123@127.0.0.1:5434/myleave`
3. `DB_SSL=false` disables SSL (local Docker doesn't need it)
4. The pool exports a single `pool` object used by all route files

---

## Switching Between Local and Neon (Production)

The `.env` file has both options commented:

```env
# Local Docker PostgreSQL (default for development)
DATABASE_URL="postgresql://myleave:myleave123@127.0.0.1:5434/myleave"
DB_SSL=false

# Production (Neon DB) - uncomment below and comment out local
# DATABASE_URL="postgresql://neondb_owner:npg_...@ep-...aws.neon.tech/neondb?sslmode=require"
# DB_SSL=true
```

To switch to Neon for testing against production data:

1. Comment out the local `DATABASE_URL` line
2. Uncomment the Neon `DATABASE_URL` line
3. Set `DB_SSL=true`
4. Restart the backend (`npm start`)

---

## Troubleshooting

### Container won't start — port conflict

```
Bind for 0.0.0.0:5434 failed: port is already allocated
```

Another process is using port 5434. Either stop it or change the port in `backend/db/docker-compose.yml`:

```yaml
ports:
  - "5435:5432"   # Change host port
```

And update `.env`:

```
DATABASE_URL="postgresql://myleave:myleave123@127.0.0.1:5435/myleave"
```

Also update `backend/db/seed-admin.js` port to match.

### Password authentication failed

```
password authentication failed for user "myleave"
```

The container may not have fully initialized. Wait 5-10 seconds after `db:up` before running `db:seed`. Or recreate:

```bash
npm run db:reset
```

### Schema not created

The `schema.sql` only runs on **first container start** (when the volume is empty). To re-apply it:

```bash
npm run db:reset
```

Or manually:

```bash
docker exec -i myleave-db psql -U myleave -d myleave < backend/db/schema.sql
```

### Seeding failed — admin already exists

```
Admin already exists: admin@eftech.com.my (E0001, role: Admin)
Skipping seed.
```

This is normal. The seeder is idempotent. To create a second admin with a different email:

```bash
node db/seed-admin.js --email=second@eftech.com.my --staff-id=E0002
```

---

## Database Tables Reference

Inferred from all route queries in the codebase. See [PROJECT_ANALYSIS.md](./PROJECT_ANALYSIS.md) for full details.

| Table | Purpose |
|-------|---------|
| `profiles` | Employee records, leave balances, role |
| `leave_requests` | All leave applications and their status |
| `leave_entitlements` | Special leave balances (HOSP, MAT, PAT, etc.) |
| `admin_logs` | Activity audit trail |
| `password_resets` | OTP codes for password reset flow |
| `role_setting` | Role overrides (elevate staff to admin/manager) |
| `public_holidays` | Custom holidays added by admin |
| `holiday_overrides` | Hidden official holidays |
