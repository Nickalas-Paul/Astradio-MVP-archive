# Astradio MVP Runbook

## Emergency Procedures

### Disable Visualization Engine
```bash
# Set environment variable
export ENABLE_VIZ_ENGINE=false

# Or via URL parameter
curl "http://localhost:3000?viz=0"
```

### Rollback Composition Model
```bash
# Update model version in compose route
# Change modelVersions.audio from "v1.1" to "v1.0"
# Redeploy
```

### Emergency Rate Limit Bypass
```bash
# Temporarily increase limits in route handlers
# Change RATE_LIMIT_MAX from 50 to 1000
# Monitor for abuse
```

## Health Checks

### Application Health
```bash
curl http://localhost:3000/readyz
```

### Individual Service Health
```bash
# Audio model
curl http://localhost:3000/api/compose -X POST -d '{"mode":"transit","seed":123}'

# Compatibility service
curl http://localhost:3000/api/compat/health

# Visualization engine
curl http://localhost:3000/readyz | jq '.checks.viz_engine_loaded'
```

## Monitoring

### Key Metrics
- `compose_latency_ms` - P95 < 1.5s
- `compat_search_latency_ms` - P95 < 500ms
- `viz_init_ms` - P95 < 15ms
- `viz_fps_avg` - > 55 FPS
- `4xx_error_rate` - < 1%
- `5xx_error_rate` - < 0.1%

### Alerts
- Rate limit spikes (`RATE_LIMITED` > 10/min)
- CSRF failures (`CSRF_FAILED` > 5/min)
- Missing requestId in logs
- Determinism failures
- CDN header mismatches

## Troubleshooting

### Common Issues

#### 1. Composition Timeout
```bash
# Check model loading
curl http://localhost:3000/readyz | jq '.checks'

# Check logs for model errors
grep "model" logs/app.log | tail -20
```

#### 2. Rate Limit False Positives
```bash
# Check rate limit buckets
grep "RATE_LIMITED" logs/app.log | tail -10

# Reset rate limits (restart required)
pkill -f "npm start"
npm start
```

#### 3. CSRF Token Issues
```bash
# Check CSRF token generation
grep "CSRF_FAILED" logs/app.log | tail -10

# Verify cookie settings
curl -I http://localhost:3000/api/compose
```

#### 4. Visualization Engine Issues
```bash
# Check feature flag
curl http://localhost:3000/readyz | jq '.checks.viz_engine_loaded'

# Disable if needed
export ENABLE_VIZ_ENGINE=false
```

### Log Analysis

#### Request Tracing
```bash
# Find request by ID
grep "requestId=req_1234567890" logs/app.log

# Check error patterns
grep "error.code" logs/app.log | sort | uniq -c
```

#### Performance Analysis
```bash
# Slow compositions
grep "compose_latency_ms" logs/app.log | awk '$2 > 2000'

# High error rates
grep "4xx\|5xx" logs/app.log | awk '{print $1}' | sort | uniq -c
```

## Deployment

### Pre-deployment Checklist
- [ ] Endpoint matrix validation passes
- [ ] All tests pass
- [ ] No dead calls or orphans
- [ ] Standard error schema applied
- [ ] Determinism verified
- [ ] CDN headers correct

### Post-deployment Verification
```bash
# Run endpoint validation
./scripts/validate-endpoints.ps1

# Check health
curl http://localhost:3000/readyz

# Test composition
curl -X POST http://localhost:3000/api/compose \
  -H "Content-Type: application/json" \
  -d '{"mode":"transit","seed":123}'
```

## Security

### CSRF Token Rotation
```bash
# Rotate on login
# Update session with new CSRF token
# Clear old tokens
```

### Rate Limit Tuning
```bash
# Monitor abuse patterns
grep "RATE_LIMITED" logs/app.log | tail -100

# Adjust limits based on usage
# Update RATE_LIMIT_MAX in route handlers
```

### Origin Validation
```bash
# Check allowed origins
grep "origin" logs/app.log | tail -20

# Update CORS settings if needed
```

## Backup & Recovery

### Database Backup
```bash
# Export user data
# Backup composition cache
# Save rate limit state
```

### Configuration Backup
```bash
# Backup environment variables
# Save feature flags
# Document model versions
```

## Performance Tuning

### Cache Optimization
```bash
# Check cache hit rates
grep "cache" logs/app.log | tail -20

# Adjust cache TTL
# Update cache keys
```

### Model Optimization
```bash
# Monitor model loading times
grep "model" logs/app.log | tail -20

# Optimize model initialization
# Update model versions
```

## Contact Information

### On-Call Rotation
- Primary: [Contact Info]
- Secondary: [Contact Info]
- Escalation: [Contact Info]

### External Dependencies
- CDN: [Contact Info]
- Model Hosting: [Contact Info]
- Monitoring: [Contact Info]
