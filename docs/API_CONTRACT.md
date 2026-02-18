# API Contract & Endpoint Matrix

## Overview

This document defines the API contract for Astradio MVP. All endpoints must follow the standard error schema and include requestId for observability.

## Endpoint Matrix

### Active Routes (14)

#### Next.js Routes (10)
- `GET /api/chart` - Chart data retrieval
- `GET /api/community/feed` - Community feed
- `POST /api/compose` - Composition generation
- `GET /api/exports` - Export listing
- `POST /api/report` - Content reporting
- `GET /api/trending` - Trending content
- `GET /api/profile` - Current user profile (stub: user + primary chart)
- `GET /api/profile/chart` - Profile chart snapshot + explainer (proxies to engine)
- `GET /api/community/search` - Directory user search (proxies to engine; query: q, limit, cursor). V1: powered by seeded directory only.
- `GET /api/compat/health` - Compatibility service health (proxies to engine)
- `GET /api/compat/matches` - Compatibility matches (proxies to engine; query: chartId, mode, limit)

#### Parameterized Next.js Routes (4)
- `POST /api/connect/[userId]` - User connections
- `POST /api/connect/accept/[requestId]` - Accept connection requests
- `POST /api/like/[itemId]` - Like content
- `POST /api/save/[trackId]` - Save tracks

#### Engine (vnext compat) Routes (served by Express when compat router mounted)
- `GET /api/profile/chart?chartId=` - Chart snapshot + explainer (vnext encoder + ExplainSpec). V1: only chartIds in the seeded directory (or default profile) are allowed (403 otherwise).
- `GET /api/community/search?q=&limit=&cursor=` - Directory user search. V1: seeded users only (match candidates). Query: q (optional, case-insensitive substring on displayName/userId), limit (default 10), cursor (optional offset). Response: `{ q, limit, users: [{ userId, displayName, chartId, label?, locationLabel? }], nextCursor?, generatedAt, version }`. Deterministic: same query returns same ordered list.
- `GET /api/compat/health` - Compatibility health
- `GET /api/compat/matches?chartId=&mode=friend|lover|rival&limit=&cursor=` - Matches (real 64-D encoder). Query: chartId (required), mode (default friend), limit (default 10), cursor (optional).

### Response shapes (community)

**GET /api/profile** (Next.js)
```json
{
  "user": { "id": "string", "displayName": "string" },
  "primaryChart": { "id": "string", "label": "string", "date": "string", "time": "string", "lat": number, "lon": number, "timezone": "string?" }
}
```
`primaryChart.id` is guaranteed to exist in engine storage (e.g. `chart_profile_default`).

**GET /api/profile/chart** (proxy → engine)
```json
{
  "chart": { "id", "label", "date", "time", "lat", "lon", ... },
  "snapshot": { "planets", "houses", ... },
  "explainer": { "spec": "UnifiedSpecV1.1", "sections": [ { "id", "title", "text", "bullets?" } ] },
  "meta": { "encoderVersion", "explainerVersion", "generatedAt" }
}
```

**GET /api/compat/matches** (proxy → engine)
```json
{
  "chartId": "string",
  "mode": "friend|lover|rival",
  "limit": number,
  "matches": [ { "userId", "chartId", "displayName?", "score", "facets", "rationale", "lastUpdated" } ],
  "generatedAt": "ISO8601",
  "version": "v1"
}
```
Scores are clamped to [0,1]. Same chartId + candidates ⇒ same order and scores (stable sort by score desc, then chartId asc).

### Deprecated Routes (5) - 410 Gone

**Removal Date: 2025-11-01**

- `POST /api/overlay` - Chart overlay (deprecated)
- `POST /api/compat/generate` - Match generation (deprecated)
- `POST /api/compat/profile` - Profile creation (deprecated)
- `GET /api/compat/profile/:userId/:chartId` - Profile retrieval (deprecated)
- `GET /api/compat/rationale/:pairId` - Rationale details (deprecated)

### Internal Routes (4)
- `GET /api/exports/[id]` - Internal export access
- Other internal pipeline routes

## Standard Error Schema

All error responses must follow this format:

```json
{
  "error": {
    "code": "UPPER_SNAKE_CASE",
    "message": "Human readable error message"
  },
  "requestId": "req_timestamp_random"
}
```

## Request/Response Requirements

### Authentication
- Write routes require authentication
- 401 for missing/invalid auth
- 403 for CSRF failures

### Rate Limiting
- 429 for rate limit exceeded
- Include `Retry-After` header
- Per-IP and per-user limits

### Observability
- All responses include `requestId`
- Logs include `{requestId, route, status, userId?, error.code?}`

## Composition Contract

### Request
```json
{
  "mode": "overlay|transit|compatibility|sandbox",
  "charts": [...],
  "seed": 123
}
```

### Response
```json
{
  "audio": {
    "url": "https://cdn.astradio.io/audio/...",
    "digest": "sha256:...",
    "latency_ms": 1500
  },
  "text": {
    "blocks": [...],
    "digest": "sha256:..."
  },
  "viz": {
    "url": "https://cdn.astradio.io/viz/...",
    "digest": "sha256:..."
  },
  "provenance": {
    "featuresVersion": "v1.0",
    "houseSystem": "placidus",
    "tzDiscipline": "utc",
    "modelVersions": {
      "audio": "v1.1",
      "text": "v1.1", 
      "viz": "1.0",
      "matching": "v1.0"
    }
  },
  "requestId": "req_..."
}
```

## Determinism Requirements

- Same `{inputHashes, seed, modelVersions}` must yield identical `audio.digest` + `viz.digest`
- Viz digest computed on minified JSON bytes
- CDN headers: `Cache-Control: public, max-age=31536000, immutable`

## Readiness Endpoint

### GET /readyz
```json
{
  "ready": true,
  "status": "ready",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "checks": {
    "model_audio": true,
    "model_text": true,
    "viz_engine_loaded": true,
    "compat_weights_loaded": true
  }
}
```

## CI Validation

The endpoint matrix is validated in CI to prevent:
- New dead calls (client → missing route)
- New orphans (route → no client)
- Missing standard error schema
- Missing requestId
- Determinism failures
- CDN header issues

## Security

- Cookies: `HttpOnly, Secure, SameSite=Strict`
- CSRF: Double-submit token validation
- Origin: Validate against allowed domains
- Rate limits: Per-IP and per-user buckets

## Observability SLOs

- P95 compose latency: < 1.5s (cached), < 2.0s (uncached)
- P95 compat search latency: < 500ms
- 4xx/5xx error rate: < 1%
- RequestId coverage: 100%
