# Hackathon ScoreBoard

Hackathon evaluation and scoring web application — React frontend with Firebase (Auth + Firestore), plus an Express API monorepo scaffold.

## Documentation

| Guide | Description |
|-------|-------------|
| **[Setup, VS Code & Render deployment](docs/SETUP_AND_DEPLOYMENT.md)** | Full local setup, VS Code tasks, commands, and step-by-step Render.com deployment |

## Quick start (local)

**Prerequisites:** Node.js 22+ or 24+, pnpm 10.x

```powershell
cd Hackathon_ScoreBoard
$env:CI = "true"
pnpm install
copy artifacts\hackathon-eval\.env.example artifacts\hackathon-eval\.env
# Edit .env with your Firebase credentials
pnpm --filter @workspace/hackathon-eval run dev
```

Open [http://localhost:19851](http://localhost:19851).

In **VS Code**: `Ctrl+Shift+P` → **Tasks: Run Task** → **dev: hackathon-eval (frontend)**.

## Stack

- pnpm workspaces, TypeScript 5.9, Node.js 22/24
- Frontend: React 19, Vite 7, Tailwind 4, Wouter, Firebase
- API: Express 5, esbuild
- DB (planned): PostgreSQL + Drizzle ORM

## Deploy

See [docs/SETUP_AND_DEPLOYMENT.md § Deploy to Render.com](docs/SETUP_AND_DEPLOYMENT.md#8-deploy-to-rendercom). An optional [`render.yaml`](render.yaml) Blueprint is included.
