# Railway Deployment — Current Status & Troubleshooting

## Problem

The Railway-deployed frontend at https://langchain-production.up.railway.app is not working despite restoring the frontend code and migrations.

## What Was Done

| Step | Commit | Status |
|------|--------|--------|
| Restored frontend (104 files) from `bfc016d` | `a7e12b4` (PR #51) | Merged to master |
| Restored migrations (15 SQL files) from `bfc016d` | `09b5098` | Pushed to master |
| Added `run_migrations.yml` GitHub Actions workflow | `2425996` | Pushed to master |
| Fixed workflow to use existing `DATABASE_URL` secret | `1c6f00d` | Pushed to master |
| Triggered migration workflow | `fe65fa5` | Ran successfully (24s) |
| PR for tracking | PR #52 | Open |

All 15 migrations have been applied to the production Supabase database (`ewkrubluzctsfnkxnmsj`).

## Identified Issues Preventing Successful Deploy

### Issue 1: `vite preview` is not a production server (CRITICAL)

The start command in `package.json` uses:

```json
"start": "vite preview --host 0.0.0.0 --port ${PORT:-3000}"
```

`vite preview` is intended for **local testing only**, not production. It is not optimized for serving traffic and may cause crashes, memory leaks, or silent failures on Railway.

**Fix:** Replace with a proper static file server (e.g., `serve`, `http-server`, or a small Express server) that serves the `dist/` directory.

### Issue 2: `${PORT:-3000}` shell expansion doesn't work in npm scripts (CRITICAL)

npm scripts run via `sh`, not `bash`. The `${PORT:-3000}` syntax may not expand correctly, causing the server to fail to bind to Railway's assigned port.

Railway sets the `PORT` environment variable (typically `8080`). If the app doesn't bind to it, Railway's health check at `/` will fail and the deploy will be marked as crashed.

**Fix:** Wrap in bash explicitly:

```json
"start": "bash -c 'vite preview --host 0.0.0.0 --port ${PORT:-3000}'"
```

Or better, use a server that reads `process.env.PORT` directly.

### Issue 3: Missing Supabase environment variables in Railway (MODERATE)

The app needs two environment variables set in the Railway service dashboard:

- `VITE_SUPABASE_URL` = `https://ewkrubluzctsfnkxnmsj.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = (the value from the `SUPABASE_ANON_KEY` GitHub secret)

**Important:** These are build-time variables (prefixed with `VITE_`), so they must be set **before** the build runs, not just at runtime. The values get baked into the JavaScript bundle during `vite build`.

The app will load without them but all data features will be disabled.

### Issue 4: Large bundle size (MINOR)

The JS bundle is 1,064 KB (313 KB gzipped). Vite flags chunks > 500 KB. This could cause slow cold starts but is not a blocker.

## Recommended Fix

Replace the start command with `serve` (a production-quality static file server):

```json
{
  "scripts": {
    "build": "tsc -b && vite build",
    "start": "serve dist --listen tcp://0.0.0.0:$PORT"
  },
  "dependencies": {
    "serve": "^14.2.0"
  }
}
```

Or use a minimal Express server:

```js
// server.js
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.static(join(__dirname, 'dist')));
app.get('*', (req, res) => res.sendFile(join(__dirname, 'dist', 'index.html')));
app.listen(process.env.PORT || 3000);
```

## Railway Environment Variables Checklist

Set these in the Railway service dashboard (Settings > Variables):

| Variable | Value | Required |
|----------|-------|----------|
| `VITE_SUPABASE_URL` | `https://ewkrubluzctsfnkxnmsj.supabase.co` | Yes (build-time) |
| `VITE_SUPABASE_ANON_KEY` | (from Supabase dashboard > API) | Yes (build-time) |
| `PORT` | Set automatically by Railway | No |

## Files Involved

- `frontend/package.json` — build/start scripts, dependencies
- `frontend/railway.toml` — Railway build config (Nixpacks)
- `frontend/src/utils/supabase.ts` — Supabase client initialization
- `frontend/.env.example` — documents required env vars
