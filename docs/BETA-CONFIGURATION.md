# Beta Configuration Guide

## Environment Variables

### Required for Beta
```bash
# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3001

# Backend URL (for API proxying) 
BACKEND_URL=http://localhost:3001

# Environment
NODE_ENV=development
```

### Beta Access Control
```bash
# Enable/disable beta
BETA_ENABLED=true
BETA_KILL_SWITCH=false

# Comma-separated list of allowed users
BETA_ALLOWLIST=admin,testuser
```

### Rate Limiting
```bash
# Rate limit window (15 minutes)
RATE_LIMIT_WINDOW_MS=900000

# Max requests per window
RATE_LIMIT_MAX_REQUESTS=100
```

## Deployment Checklist

### Day 1: Local Development ✅
- [x] Port configuration fixed (3000 → 3001)
- [x] Geocode API route created
- [x] Wheel data contract adapter added
- [x] Geolocation label back-propagation

### Day 2: Production Hardening
- [ ] CORS configuration added
- [ ] Input validation with Zod
- [ ] Rate limiting implemented
- [ ] Audio gesture UX added
- [ ] Health check endpoint
- [ ] Error handling improved

### Day 3: Deployment & Testing
- [ ] Deploy to Vercel (frontend) + Railway (backend)
- [ ] Cross-origin testing
- [ ] Latency benchmarking
- [ ] Invite gate implementation
- [ ] Beta user onboarding

## API Endpoints

### Core Endpoints
- `POST /api/compose` - Generate astrological composition
- `GET /api/geocode?q=query` - Geocode location search
- `GET /api/health` - Health check

### Beta Features
- `GET /api/trending` - Trending compositions
- `GET /api/community/feed` - Community feed
- `POST /api/feedback` - User feedback

## Acceptance Criteria

### Functional
- [ ] Compose endpoint returns valid chart data
- [ ] Wheel renders correctly with no console errors
- [ ] Geolocation works with fallback
- [ ] Audio plays after user gesture
- [ ] All inputs trigger single compose call

### Performance
- [ ] Compose latency < 1.5s P50 locally
- [ ] Compose latency < 3s P95 over production link
- [ ] Page load < 2s on cold start

### Security
- [ ] CORS properly configured
- [ ] Input validation on all endpoints
- [ ] Rate limiting active
- [ ] No sensitive data exposure
