# 🎮 GameTracker

A Goodreads-like platform for video games. Track your library, discover new games, and get personalized recommendations.

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js (App Router), TypeScript, Tailwind CSS, Framer Motion, shadcn/ui |
| **Backend** | Node.js, Express, TypeScript |
| **Database** | PostgreSQL (Prisma ORM) |
| **Cache** | Redis |
| **Auth** | JWT + OAuth (Google, Apple) |
| **Game Data** | RAWG API |
| **Infra** | Docker, npm workspaces monorepo |

---

## Project Structure

```
GameTracker/
├── packages/
│   ├── shared/          # Portable types, constants, validators, utils
│   │   └── src/
│   │       ├── types.ts
│   │       ├── constants.ts
│   │       ├── validators.ts
│   │       ├── utils.ts
│   │       └── index.ts
│   ├── backend/         # Express API server
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   └── src/
│   │       ├── config.ts
│   │       ├── app.ts
│   │       └── index.ts
│   └── web/             # Next.js web application
│       └── src/
│           ├── app/
│           │   ├── layout.tsx
│           │   ├── page.tsx
│           │   └── globals.css
│           └── lib/
│               └── utils.ts
├── docker-compose.yml   # Postgres + Redis for local dev
├── Dockerfile.backend   # Production backend image
├── tsconfig.base.json   # Shared TypeScript config
├── .eslintrc.js         # ESLint config
├── .prettierrc          # Prettier config
├── .env.example         # Environment variable template
└── package.json         # Monorepo root (npm workspaces)
```

---

## Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- **Docker** + **Docker Compose** (for Postgres & Redis)
- A [RAWG API key](https://rawg.io/apidocs) (free tier works — needed in Phase 3)

---

## Quick Start

### 1. Clone & Install

```bash
git clone <repo-url> GameTracker
cd GameTracker
npm install
```

### 2. Environment Variables

```bash
cp .env.example .env
# Edit .env with your values (defaults work for local dev)
```

### 3. Start Infrastructure

```bash
docker compose up -d
```

This starts:
- **PostgreSQL** on `localhost:5432`
- **Redis** on `localhost:6379`

### 4. Run Database Migrations

```bash
cd packages/backend
npx prisma migrate dev --name init
npx prisma generate
```

### 5. Seed the Database

```bash
npm run seed -w packages/backend
```

### 6. Build Shared Package

```bash
npm run build:shared
```

### 7. Start Development Servers

```bash
# From root — starts both backend and web
npm run dev

# Or individually:
npm run dev:backend   # Express API on http://localhost:4000
npm run dev:web       # Next.js on http://localhost:3000
```

### 8. Verify

- **API Health**: http://localhost:4000/health
- **API Info**: http://localhost:4000/api/v1
- **Web App**: http://localhost:3000

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start backend + web in parallel |
| `npm run dev:backend` | Start backend only (hot reload) |
| `npm run dev:web` | Start Next.js dev server |
| `npm run build` | Build all packages |
| `npm run build:shared` | Build shared package |
| `npm run lint` | Lint all TypeScript files |
| `npm run format` | Format all source files |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed database |
| `npm run db:studio` | Open Prisma Studio |
| `npm run clean` | Remove all build artifacts |

---

## Database Schema

**Core tables:**
- `users` — accounts with password hash + OAuth columns
- `games` — normalized game records (synced from RAWG)
- `platforms` / `genres` / `tags` — lookup tables
- `game_platforms` / `game_genres` / `game_tags` — many-to-many junctions
- `game_screenshots` — game media
- `libraries` — user-created game shelves
- `library_items` — games added to libraries
- `recommendations` — personalized game suggestions

Open Prisma Studio to explore: `npm run db:studio`

---

## Architecture Notes

- **Shared package** contains zero browser-only or Node-only imports. It is designed to be consumed by a future React Native mobile app without modification.
- **Backend** uses Express with full security middleware (helmet, CORS, rate limiting).
- **Web** uses Next.js App Router with Tailwind v4 and is fully responsive for desktop and mobile browsers.
- **All configuration** flows through environment variables — no hardcoded secrets.
- **Structured logging** via Pino with JSON output in production and pretty-print in development.
- **Testing** — 19 unit tests (Vitest) covering JWT, password hashing, auth middleware, and health endpoints.
- **Production Docker** — multi-stage Dockerfiles for backend and web, Nginx reverse proxy, `docker-compose.prod.yml` for one-command deployment.
- **CI/CD** — GitHub Actions pipeline with lint, type-check, test, and Docker build jobs.

---

## Phase Roadmap

- [x] **Phase 1** — System Architecture & Project Scaffolding
- [x] **Phase 2** — Auth + User System
- [x] **Phase 3** — Game Data Pipeline (RAWG integration)
- [x] **Phase 4** — Core Features (Libraries)
- [x] **Phase 5** — Recommendation Engine
- [x] **Phase 6** — UI/UX System
- [x] **Phase 7** — QA + Deployment
- [ ] **Phase 8** — Mobile App (React Native + Expo)
