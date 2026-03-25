# Deployment Guide

GameCase is deployed as two services:

| Component | Platform | URL |
|-----------|----------|-----|
| **Frontend** (Next.js) | Vercel | `https://your-app.vercel.app` |
| **Backend** (Express API) | Railway | `https://your-api.up.railway.app` |
| **PostgreSQL** | Railway (plugin) | Provided by Railway |
| **Redis** | Railway (plugin) | Provided by Railway |

---

## Prerequisites

- GitHub repository with the GameCase monorepo pushed
- [Vercel account](https://vercel.com) (free tier works)
- [Railway account](https://railway.app) (Hobby plan recommended — $5/mo)
- A [RAWG API key](https://rawg.io/apidocs) (free)

---

## 1. Deploy Backend to Railway

### 1a. Create a new Railway project

1. Go to [railway.app/new](https://railway.app/new)
2. Click **"Deploy from GitHub Repo"**
3. Select your GameCase repository
4. Railway will detect the `railway.toml` and `Dockerfile.backend` automatically

### 1b. Add PostgreSQL

1. In your Railway project, click **"+ New"** → **"Database"** → **"PostgreSQL"**
2. Railway auto-provisions the database and provides a `DATABASE_URL`
3. In the **backend service** Variables tab, click **"Add a Reference"** and link `DATABASE_URL` to the Postgres plugin

### 1c. Add Redis

1. Click **"+ New"** → **"Database"** → **"Redis"**
2. In the backend service Variables tab, add a reference to `REDIS_URL` from the Redis plugin

### 1d. Set environment variables

In the **backend service** → **Variables** tab, add:

| Variable | Value |
|----------|-------|
| `PORT` | `4000` (Railway will also map this automatically) |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | _(auto-linked from Postgres plugin)_ |
| `REDIS_URL` | _(auto-linked from Redis plugin)_ |
| `JWT_SECRET` | _(generate: `openssl rand -base64 32`)_ |
| `JWT_REFRESH_SECRET` | _(generate: `openssl rand -base64 32`)_ |
| `CORS_ORIGIN` | `https://your-app.vercel.app` |
| `RAWG_API_KEY` | _(your RAWG key)_ |

> **Tip**: After deploying Vercel (step 2), come back and update `CORS_ORIGIN` with your actual Vercel URL. You can add multiple origins comma-separated: `https://your-app.vercel.app,https://your-app-git-main.vercel.app`

### 1e. Deploy

Railway will build the Docker image and start the service. Check the **Deployments** tab for logs. Once healthy, note your Railway public URL (e.g. `https://gamecase-backend-production.up.railway.app`).

To generate a public URL: **Settings** → **Networking** → **Generate Domain**.

---

## 2. Deploy Frontend to Vercel

### 2a. Import project

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **"Import Git Repository"** and select your GameCase repo
3. Vercel will detect the `vercel.json` and auto-configure the build

### 2b. Set environment variables

In Vercel's project **Settings** → **Environment Variables**, add:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://your-railway-url.up.railway.app/api/v1` |

> Replace `your-railway-url` with the actual Railway domain from step 1e.

### 2c. Deploy

Click **Deploy**. Vercel will:
1. Run `npm install`
2. Build the shared package
3. Build the Next.js app with your API URL baked in
4. Deploy to the edge

### 2d. Update Railway CORS

Go back to Railway and update the backend `CORS_ORIGIN` to include your Vercel production URL:

```
https://your-app.vercel.app
```

---

## 3. Verify Deployment

1. **Backend health**: Visit `https://your-railway-url.up.railway.app/health`
   - Should return `{ "status": "ok", "timestamp": "..." }`

2. **Backend readiness**: Visit `https://your-railway-url.up.railway.app/health/ready`
   - Should return `{ "status": "ready", "checks": { "postgres": "ok", "redis": "ok" } }`

3. **Frontend**: Visit your Vercel URL
   - The app should load and be able to sign up / log in

---

## 4. Ongoing Deployments

### Automatic deploys
- **Vercel**: Every push to `main` triggers a production deploy. PRs get preview deploys.
- **Railway**: Every push to `main` triggers a build + deploy with automatic migrations.

### Database migrations
Migrations run automatically on each Railway deploy via the `startCommand` in `railway.toml`:
```
npx prisma migrate deploy --schema=./prisma/schema.prisma && node dist/index.js
```

### Manual migration (if needed)
```bash
# Using Railway CLI
railway run npx prisma migrate deploy --schema=packages/backend/prisma/schema.prisma
```

---

## 5. Environment Variable Reference

### Backend (Railway)

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | `production` |
| `PORT` | No | Server port (Railway assigns automatically) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `JWT_SECRET` | Yes | Access token signing secret |
| `JWT_REFRESH_SECRET` | Yes | Refresh token signing secret |
| `CORS_ORIGIN` | Yes | Allowed frontend origin(s), comma-separated |
| `RAWG_API_KEY` | Yes | RAWG API key for game data |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |

### Frontend (Vercel)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Full backend API base URL (e.g. `https://api.railway.app/api/v1`) |

---

## Alternative: Docker Compose (Self-hosted)

If you prefer self-hosting, use the production Docker Compose file:

```bash
# Copy and fill in environment variables
cp .env.example .env
# Edit .env with production values

# Build and start all services
docker compose -f docker-compose.prod.yml up --build -d

# Run migrations (first time only, after that they run on container start)
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy --schema=./prisma/schema.prisma
```

This starts: PostgreSQL, Redis, Backend API, Next.js Web, and Nginx reverse proxy on port 80.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| CORS errors in browser | Make sure `CORS_ORIGIN` on Railway matches your Vercel URL exactly (including `https://`) |
| API calls failing | Verify `NEXT_PUBLIC_API_URL` on Vercel includes `/api/v1` suffix |
| Database connection errors | Check Railway Postgres plugin is linked and `DATABASE_URL` variable is populated |
| Migrations failing | Run `railway logs` to see the migration output; ensure schema file exists |
| Build failing on Vercel | Make sure the shared package builds first — `vercel.json` handles this |

---

## 6. Mobile App (EAS Build)

### 6a. Create an Expo account

1. Sign up at [expo.dev](https://expo.dev) (free)
2. Install EAS CLI: `npm install -g eas-cli`
3. Log in: `eas login`

### 6b. Initialize EAS in the mobile package

```bash
cd packages/mobile
npx eas init
```

This will:
- Create an Expo project (if one doesn't exist)
- Populate the `projectId` in `app.config.ts` → `extra.eas.projectId`
- Create `eas.json` if it doesn't exist

> **After running `eas init`**, update `app.config.ts`:
> ```ts
> eas: {
>   projectId: 'YOUR-ACTUAL-UUID-HERE',  // from eas init output
> }
> ```
> or set the environment variable: `EAS_PROJECT_ID=your-uuid`

### 6c. Set mobile environment variables

Create `packages/mobile/.env` (or use EAS secrets for production builds):

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_API_URL` | Yes | Backend API base URL (e.g. `https://your-api.railway.app/api/v1`) |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | No | Google OAuth client ID (Expo/native) |
| `EXPO_PUBLIC_GOOGLE_REDIRECT_URI` | No | Override Google OAuth proxy redirect URI (default: `https://auth.expo.io/@jjosephsen/gamecase`) |

> **Note**: `EXPO_PUBLIC_*` variables are baked into the app bundle at build time. For production builds, set them as EAS environment variables in the Expo dashboard or via `eas secret:create`.

### 6d. Build the app

```bash
cd packages/mobile

# iOS simulator build (no Apple account needed)
eas build --platform ios --profile preview

# Android APK (no Google Play needed)
eas build --platform android --profile preview

# Production builds (requires Apple Developer / Google Play accounts)
eas build --platform ios --profile production
eas build --platform android --profile production
```

### 6e. Replace placeholder assets

The `packages/mobile/assets/icon.png` and `packages/mobile/assets/splash.png` are solid `#0f172a` placeholders. **Before submitting to app stores**, replace them with proper branded artwork:

- `icon.png` — 1024×1024 px, PNG, no transparency (iOS)
- `splash.png` — 2048×2048 px, PNG (centered logo recommended)

Re-generate: `node packages/mobile/scripts/gen-assets.js` produces new placeholders if needed.
