# Hackathon ScoreBoard — Setup, VS Code, and Render Deployment Guide

This document explains how to run the project locally in **VS Code** and how to deploy it to **[Render](https://render.com)**.

---

## Table of contents

1. [What this project is](#1-what-this-project-is)
2. [Prerequisites](#2-prerequisites)
3. [Repository layout](#3-repository-layout)
4. [First-time setup](#4-first-time-setup)
5. [Run locally in VS Code](#5-run-locally-in-vs-code)
6. [Environment variables](#6-environment-variables)
7. [Useful commands reference](#7-useful-commands-reference)
8. [Deploy to Render.com](#8-deploy-to-rendercom)
9. [Firebase configuration for production](#9-firebase-configuration-for-production)
10. [Optional: PostgreSQL on Render](#10-optional-postgresql-on-render)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. What this project is

**Hackathon ScoreBoard** is a monorepo (pnpm workspaces) for a hackathon **evaluation and scoring** web application.

| Component | Package | Technology | Role |
|-----------|---------|------------|------|
| **Main app (UI)** | `@workspace/hackathon-eval` | React 19, Vite 7, Tailwind 4 | Login, dashboards for admin / evaluator / coordinator |
| **API server** | `@workspace/api-server` | Express 5, esbuild | REST API (currently `GET /api/healthz` only) |
| **Data (runtime)** | Firebase | Auth + Firestore | Users, evaluations, rankings (used by the UI) |
| **Data (planned)** | `@workspace/db` | PostgreSQL + Drizzle | Schema scaffold exists; tables not defined yet |
| **API contracts** | `lib/api-spec`, `lib/api-zod`, `lib/api-client-react` | OpenAPI + Orval | Codegen for future API features |

**Important:** The UI talks to **Firebase directly**. The Express API is minimal today. You can deploy the frontend alone and the app will work if Firebase is configured correctly.

---

## 2. Prerequisites

Install these on your machine before developing:

| Tool | Recommended version | Check with |
|------|---------------------|------------|
| **Node.js** | 22.x or 24.x (docs target 24) | `node -v` |
| **pnpm** | 10.x | `pnpm -v` or see below |
| **Git** | Any recent version | `git -v` |
| **VS Code** | Latest stable | — |

### Install pnpm (if not installed)

**Option A — Corepack (recommended with Node 16.13+):**

```powershell
corepack enable
corepack prepare pnpm@10.34.1 --activate
pnpm -v
```

**Option B — Without global install (works everywhere):**

```powershell
npx --yes pnpm@10 -v
```

Use `npx --yes pnpm@10` instead of `pnpm` in all commands below if you do not have pnpm on your PATH.

### External services (for full app behavior)

- A **Firebase** project (Authentication + Firestore)
- **PostgreSQL** only if you use Drizzle migrations (`DATABASE_URL`) — optional for current UI

---

## 3. Repository layout

```
Hackathon_ScoreBoard/
├── package.json                 # Workspace root
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── render.yaml                  # Optional Render Blueprint
├── docs/
│   └── SETUP_AND_DEPLOYMENT.md  # This file
├── .vscode/
│   ├── tasks.json               # VS Code tasks (Run Task…)
│   └── settings.json            # Recommended editor settings
├── lib/
│   ├── db/                      # Drizzle + Postgres
│   ├── api-spec/                # openapi.yaml
│   ├── api-zod/
│   └── api-client-react/
└── artifacts/
    ├── hackathon-eval/          # ★ Main React app
    │   ├── .env                 # Local secrets (do not commit)
    │   ├── .env.example
    │   └── public/
    ├── api-server/              # Express API
    └── mockup-sandbox/          # UI component sandbox (optional)
```

---

## 4. First-time setup

Open a terminal in the **repository root** (`Hackathon_ScoreBoard`).

### Step 1 — Clone and enter the project

```powershell
cd "c:\path\to\Hackathon_ScoreBoard"
```

If root files like `package.json` are missing, restore them from git:

```powershell
git checkout HEAD -- package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json tsconfig.base.json
```

### Step 2 — Install dependencies

```powershell
$env:CI = "true"
pnpm install
```

> **Windows note:** `CI=true` avoids pnpm asking to confirm deletion of `node_modules` when there is no TTY.

### Step 3 — Configure environment variables

```powershell
copy artifacts\hackathon-eval\.env.example artifacts\hackathon-eval\.env
```

Edit `artifacts\hackathon-eval\.env` and fill in your Firebase values from the [Firebase Console](https://console.firebase.google.com/) → Project settings → Your apps → Web app config.

### Step 4 — Verify install (optional)

```powershell
pnpm run typecheck
```

---

## 5. Run locally in VS Code

### 5.1 Open the project

1. Open VS Code.
2. **File → Open Folder…** → select `Hackathon_ScoreBoard` (the repo root, not `artifacts/hackathon-eval`).
3. Install recommended extensions if prompted (or see `.vscode/extensions.json`).

### 5.2 Using built-in VS Code tasks (easiest)

1. Press **`Ctrl+Shift+P`** (Windows) or **`Cmd+Shift+P`** (macOS).
2. Type **`Tasks: Run Task`** and press Enter.
3. Choose one of:

| Task name | What it does |
|-----------|----------------|
| **pnpm: install** | Install all workspace dependencies |
| **dev: hackathon-eval (frontend)** | Starts Vite on port **19851** |
| **dev: api-server** | Builds and starts API on port **5000** |
| **build: hackathon-eval** | Production build of the frontend |
| **build: api-server** | esbuild bundle for the API |

4. Open the terminal panel to see logs.

**Frontend URL:** [http://localhost:19851/](http://localhost:19851/)  
**API health check:** [http://localhost:5000/api/healthz](http://localhost:5000/api/healthz)

### 5.3 Using the integrated terminal (manual commands)

Open **Terminal → New Terminal** in VS Code (`Ctrl+`` `). Ensure the cwd is the **repo root**.

**Terminal 1 — Frontend (required for the app UI):**

```powershell
pnpm --filter @workspace/hackathon-eval run dev
```

**Terminal 2 — API (optional; health check only today):**

```powershell
$env:PORT = "5000"
$env:NODE_ENV = "development"
pnpm --filter @workspace/api-server run dev
```

On **Windows**, if `pnpm run dev` for the API fails with `'export' is not recognized`, use:

```powershell
$env:PORT = "5000"
pnpm --filter @workspace/api-server run build
node --enable-source-maps artifacts/api-server/dist/index.mjs
```

### 5.4 Run frontend + API together

**VS Code:** `Ctrl+Shift+P` → **Tasks: Run Task** → **dev: all (frontend + API)**.

This starts two terminal panels (frontend on port 19851, API on port 5000).

### 5.5 Expected local behavior

| Service | Port | Success indicator |
|---------|------|-------------------|
| Frontend | `19851` (from `.env` `PORT`) | Browser shows login page |
| API | `5000` | `{"status":"ok"}` from `/api/healthz` |

After login, Firebase must have user documents in Firestore (`users` collection) with a `role` field (`admin`, `evaluator`, or `coordinator`).

---

## 6. Environment variables

### 6.1 Frontend — `artifacts/hackathon-eval/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Dev server port (default `19851`) |
| `BASE_PATH` | No | URL base path (default `/`) |
| `VITE_FIREBASE_API_KEY` | **Yes** | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | **Yes** | e.g. `your-project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | **Yes** | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | **Yes** | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | **Yes** | Firebase sender ID |
| `VITE_FIREBASE_APP_ID` | **Yes** | Firebase app ID |

> Vite embeds `VITE_*` variables at **build time**. On Render, set them in the service **Environment** tab before deploying.

### 6.2 API server

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | **Yes** | Listen port (Render sets this automatically) |
| `NODE_ENV` | No | `development` or `production` |
| `LOG_LEVEL` | No | Pino log level (default `info`) |
| `DATABASE_URL` | No* | Postgres URL — only when API imports `@workspace/db` |

\*Not required for the current health-only API.

### 6.3 Database (Drizzle CLI only)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | **Yes** for `pnpm --filter @workspace/db run push` | PostgreSQL connection string |

---

## 7. Useful commands reference

All commands assume you are in the **repository root**.

| Goal | Command |
|------|---------|
| Install dependencies | `pnpm install` |
| Run frontend dev | `pnpm --filter @workspace/hackathon-eval run dev` |
| Run API dev | `pnpm --filter @workspace/api-server run dev` |
| Run both | `pnpm run dev:all` |
| Build frontend | `pnpm --filter @workspace/hackathon-eval run build` |
| Preview production frontend | `pnpm --filter @workspace/hackathon-eval run serve` |
| Build API | `pnpm --filter @workspace/api-server run build` |
| Start API (after build) | `node --enable-source-maps artifacts/api-server/dist/index.mjs` |
| Typecheck entire repo | `pnpm run typecheck` |
| Build everything | `pnpm run build` |
| Regenerate API client from OpenAPI | `pnpm --filter @workspace/api-spec run codegen` |
| Push DB schema (needs Postgres) | `pnpm --filter @workspace/db run push` |

**Frontend build output directory:** `artifacts/hackathon-eval/dist/public`

---

## 8. Deploy to Render.com

Render can host this project as:

1. **Static Site** — frontend (recommended, primary user-facing app)
2. **Web Service** — Express API (optional today)
3. **PostgreSQL** — optional, for future Drizzle usage

You can deploy manually in the Render Dashboard or use the included **`render.yaml`** Blueprint.

---

### 8.1 Before you deploy

1. Push your code to **GitHub** or **GitLab** (Render deploys from Git).
2. Do **not** commit `.env` files with secrets. Use Render environment variables instead.
3. Prepare Firebase production settings (see [Section 9](#9-firebase-configuration-for-production)).

---

### 8.2 Deployment architecture on Render

```
                    ┌─────────────────────────┐
                    │   Firebase (cloud)      │
                    │   Auth + Firestore      │
                    └───────────┬─────────────┘
                                │
┌───────────────┐     HTTPS     │
│ Render        │◄──────────────┘
│ Static Site   │  Browser loads React app
│ hackathon-eval│  (VITE_* baked into build)
└───────────────┘

┌───────────────┐     Optional
│ Render        │  GET /api/healthz
│ Web Service   │
│ api-server    │
└───────────────┘
```

---

### 8.3 Option A — Deploy with Blueprint (`render.yaml`)

1. Log in to [dashboard.render.com](https://dashboard.render.com).
2. Click **New +** → **Blueprint**.
3. Connect your Git repository.
4. Render detects `render.yaml` at the repo root.
5. Review the two services:
   - `hackathon-eval` (static site)
   - `hackathon-api` (web service, optional)
6. When prompted, set **environment variables** for the static site (all `VITE_FIREBASE_*` values).
7. Click **Apply**.

Render will run install/build commands defined in `render.yaml` on each push to your default branch.

---

### 8.4 Option B — Manual step-by-step (Dashboard)

#### Part 1 — Deploy the frontend (Static Site)

1. **New +** → **Static Site**.
2. Connect your repository.
3. Configure:

| Field | Value |
|-------|-------|
| **Name** | `hackathon-eval` (or any name) |
| **Branch** | `main` |
| **Root Directory** | *(leave empty — repo root)* |
| **Build Command** | See below |
| **Publish Directory** | `artifacts/hackathon-eval/dist/public` |

**Build Command:**

```bash
corepack enable && corepack prepare pnpm@10.34.1 --activate && pnpm install --frozen-lockfile && pnpm --filter @workspace/hackathon-eval run build
```

4. **Environment** → Add variables (same names as `.env.example`):

   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

   Optional:

   - `BASE_PATH` = `/` (unless hosting under a subpath)

5. **Redirects / Rewrites** (required for client-side routing with Wouter):

   | Source | Destination | Action |
   |--------|-------------|--------|
   | `/*` | `/index.html` | **Rewrite** |

   Without this, refreshing `/login` or `/admin` returns 404.

6. Click **Create Static Site** and wait for the first deploy.

7. Note your URL, e.g. `https://hackathon-eval.onrender.com`.

#### Part 2 — Deploy the API (Web Service, optional)

1. **New +** → **Web Service**.
2. Connect the same repository.
3. Configure:

| Field | Value |
|-------|-------|
| **Name** | `hackathon-api` |
| **Runtime** | **Node** |
| **Build Command** | See below |
| **Start Command** | See below |

**Build Command:**

```bash
corepack enable && corepack prepare pnpm@10.34.1 --activate && pnpm install --frozen-lockfile && pnpm --filter @workspace/api-server run build
```

**Start Command:**

```bash
node --enable-source-maps artifacts/api-server/dist/index.mjs
```

4. **Environment:**

   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `LOG_LEVEL` | `info` |

   Do **not** set `PORT` — Render injects it automatically.

5. Create the service. Test: `https://<your-api>.onrender.com/api/healthz` → `{"status":"ok"}`.

> The UI does not call this API yet for core features. Deploy the API when you add real REST endpoints.

#### Part 3 — PostgreSQL (optional, future)

1. **New +** → **PostgreSQL**.
2. Create a database in the same region as your services.
3. Copy the **Internal Database URL** (for services on Render) or **External** (for local CLI).
4. Add `DATABASE_URL` to the API service environment when Drizzle tables exist.
5. Run migrations from your machine or a one-off job:

   ```bash
   DATABASE_URL="postgresql://..." pnpm --filter @workspace/db run push
   ```

---

### 8.5 Render environment summary

#### Static site (`hackathon-eval`)

| Variable | Build-time? | Required |
|----------|-------------|----------|
| `VITE_FIREBASE_API_KEY` | Yes | Yes |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | Yes |
| `VITE_FIREBASE_PROJECT_ID` | Yes | Yes |
| `VITE_FIREBASE_STORAGE_BUCKET` | Yes | Yes |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Yes | Yes |
| `VITE_FIREBASE_APP_ID` | Yes | Yes |
| `BASE_PATH` | Yes | No (default `/`) |

#### Web service (`api-server`)

| Variable | Required |
|----------|----------|
| `NODE_ENV` | Recommended (`production`) |
| `PORT` | Auto-set by Render |
| `DATABASE_URL` | Only when DB is used |

---

### 8.6 Custom domain (optional)

1. In the static site → **Settings** → **Custom Domains**.
2. Add your domain and follow DNS instructions (CNAME to Render).
3. Add the domain to **Firebase Authorized domains** (Section 9).

---

### 8.7 Post-deploy checklist

- [ ] Static site build succeeded (green deploy)
- [ ] SPA rewrite rule `/*` → `/index.html` is configured
- [ ] All `VITE_FIREBASE_*` variables set on Render
- [ ] Firebase authorized domains include `*.onrender.com` and your custom domain
- [ ] Login works in production
- [ ] (Optional) API `/api/healthz` returns 200

---

## 9. Firebase configuration for production

1. Open [Firebase Console](https://console.firebase.google.com/) → your project.
2. **Authentication** → **Settings** → **Authorized domains**:
   - Add `your-app.onrender.com`
   - Add any custom domain
3. **Firestore** → ensure security rules allow your app’s access pattern.
4. **Authentication** → enable **Email/Password** (or methods you use in the app).
5. Ensure each user has a document in `users/{uid}` with fields expected by the app (including `role`).

If login fails only in production, authorized domains and Firestore rules are the most common causes.

---

## 10. Optional: PostgreSQL on Render

The `lib/db` package is prepared for Postgres but has an **empty schema**. When you add tables:

1. Create Render Postgres.
2. Set `DATABASE_URL` on the API service.
3. Run `pnpm --filter @workspace/db run push` locally or in a Render shell.
4. Wire API routes to use `@workspace/db`.

---

## 11. Troubleshooting

### `pnpm` not found

Use `npx --yes pnpm@10` or install via Corepack (`corepack enable`).

### `pnpm install` asks to delete `node_modules` and hangs

```powershell
$env:CI = "true"
pnpm install
```

### API `dev` script fails on Windows (`export` not recognized)

Use the VS Code task **dev: api-server** or:

```powershell
$env:PORT = "5000"
pnpm --filter @workspace/api-server run build
node --enable-source-maps artifacts/api-server/dist/index.mjs
```

### Frontend shows blank page / Firebase errors

- Check browser console.
- Verify all `VITE_FIREBASE_*` values in `.env` (local) or Render (production).
- Restart dev server after changing `.env`.

### Render build fails on `pnpm install`

- Ensure `pnpm-lock.yaml` is committed.
- Use the exact build command from Section 8.4 with `corepack` and `--frozen-lockfile`.

### 404 on refresh in production (`/admin`, `/login`, etc.)

Add SPA rewrite: `/*` → `/index.html` on the static site.

### Login works locally but not on Render

Add Render URL to Firebase **Authorized domains**.

### `DATABASE_URL must be set`

Only appears when importing `@workspace/db`. Set `DATABASE_URL` or avoid importing the DB package until Postgres is ready.

---

## Quick reference card

**Local (VS Code terminal, repo root):**

```powershell
pnpm install
pnpm --filter @workspace/hackathon-eval run dev
# → http://localhost:19851
```

**Render static site build:**

```bash
corepack enable && corepack prepare pnpm@10.34.1 --activate && pnpm install --frozen-lockfile && pnpm --filter @workspace/hackathon-eval run build
```

**Publish directory:** `artifacts/hackathon-eval/dist/public`

---

*Last updated for the Hackathon ScoreBoard monorepo structure as of project analysis.*
