# Sandbox 404 Diagnostic

## Diagnostic Results

### URLs tested (POST with minimal valid body)

| URL | Status | Source |
|-----|--------|--------|
| `http://localhost:3000/api/sandbox/snapshot` | **404** | Next.js (proxy) |
| `http://localhost:3000/api/sandbox/report` | **404** | Next.js (proxy) |
| `http://localhost:4000/api/sandbox/snapshot` | **200** | Engine (direct) |
| `http://localhost:4000/api/sandbox/report` | **200** | Engine (direct) |

### Conclusion

- **Engine (4000)**: Sandbox routes work correctly. Both `/api/sandbox/snapshot` and `/api/sandbox/report` return 200.
- **Next.js (3000)**: Proxy returned 404. Root cause: Next.js was running from project root, which does not contain the `apps/web/app` directory. The sandbox proxy route at `apps/web/app/api/sandbox/[...path]/route.ts` was never loaded.

## Fixes Applied

### 1. Web dev script

Updated `package.json`:

```json
"web:dev": "next dev apps/web -p 3000"
```

Next.js now runs from `apps/web`, so it loads the App Router and `app/api/sandbox/[...path]/route.ts`.

### 2. Engine base URL

All Next.js API proxies use `getEngineBaseUrl()` which defaults to `http://localhost:4000`. Replaced hardcoded `localhost:3000` in:

- charts, chart, comparisons, exports, ml-status, ip-geo, geocode, compose

### 3. Sandbox proxy route

Confirms existence and correctness of:

- `apps/web/app/api/sandbox/[...path]/route.ts`
- Forwards POST to `${getEngineBaseUrl()}/api/sandbox/${path.join('/')}`
- Preserves method, Content-Type, and body

### 4. Engine route mounting

- `server/index.js`: `app.use("/api", sandboxMod.createSandboxRouter())`
- `vnext/api/sandbox-routes.ts`: Router defines `POST /sandbox/snapshot` and `POST /sandbox/report`
- Full paths: `/api/sandbox/snapshot`, `/api/sandbox/report`

## How to run the diagnostic

```powershell
# Terminal 1: npm run engine:dev
# Terminal 2: npm run web:dev
npm run diag:sandbox
```

Or manually:

```powershell
npm run vnext:build
node dist/vnext/vnext/scripts/diag-sandbox-404.js
```

## Acceptance

With engine on 4000 and Next on 3000:

- `POST http://localhost:4000/api/sandbox/snapshot` → 200
- `POST http://localhost:4000/api/sandbox/report` → 200
- `POST http://localhost:3000/api/sandbox/snapshot` → 200 (via proxy)
- `POST http://localhost:3000/api/sandbox/report` → 200 (via proxy)
