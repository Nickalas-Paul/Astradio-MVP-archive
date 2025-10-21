# Beta Handoff Checklist

## Performance Budgets

### Compose Latency
- **P50**: < 100ms
- **P95**: < 200ms
- **P99**: < 500ms
- **Max**: < 1000ms

### Audio Startup
- **P50**: < 50ms
- **P95**: < 100ms
- **P99**: < 200ms
- **Max**: < 500ms

### Memory Usage
- **Baseline**: < 256MB
- **Peak**: < 512MB
- **Growth**: < 1MB/hour

### CPU Usage
- **Baseline**: < 25%
- **Peak**: < 50%
- **Sustained**: < 35%

## Export Sanity Check

### Export Round-Trip Test
1. **Generate**: Create composition in staging
2. **Export**: Download audio file
3. **Verify**: File is valid MP3, plays correctly
4. **Size**: File size reasonable (< 10MB for 60s)
5. **Quality**: Audio quality acceptable

### Export Requirements
- **Format**: MP3, 44.1kHz, 128kbps
- **Duration**: 60 seconds
- **Size**: < 10MB
- **Quality**: No clipping, clear audio

## Security Sweep

### Headers
- **CORS**: Exact origins, no wildcards
- **CSP**: Content Security Policy present
- **HSTS**: HTTP Strict Transport Security
- **X-Frame-Options**: DENY
- **X-Content-Type-Options**: nosniff

### CORS Configuration
- **Origins**: Exact staging/production domains
- **Methods**: GET, POST, OPTIONS only
- **Headers**: Content-Type, Authorization only
- **Credentials**: false

### Dependency Audit
- **Vulnerabilities**: 0 critical, 0 high
- **Outdated**: < 5% of dependencies
- **Licenses**: All compatible
- **Size**: < 100MB total

## Documentation Freeze

### UnifiedSpecV1.1
- **Contract**: Frozen, no changes
- **Examples**: 3 canonical cases documented
- **Validation**: Input/output schemas locked
- **Versioning**: Semantic versioning enforced

### Runbook
- **Deploy**: Step-by-step deployment guide
- **Rollback**: Emergency rollback procedure
- **Incident**: Incident response playbook
- **Monitoring**: Alert configuration

## Go/No-Go Criteria

### ✅ Go (All Green)
- Determinism proven in staging UI
- Audio URL-first with fallback ≤ 2%
- Wheel/Text exclusively from compose payload
- Readiness stable (bounded, non-flaky)
- Performance within budgets
- Security checklist complete
- Documentation frozen
- Export functionality verified

### ❌ No-Go (Any Red)
- Determinism failures
- Fallback rate > 2%
- Performance exceeds budgets
- Security issues
- Documentation incomplete
- Export failures
- Critical regressions

## Evidence Requirements

### Staging Evidence
- **HAR Files**: 3 golden charts
- **Screenshots**: Desktop + mobile with hashes
- **Telemetry**: 24h performance data
- **Rate Limit**: 429 response proof
- **Fail-Closed**: 400 response proof

### Soak Evidence
- **Performance**: 24h latency/startup metrics
- **Reliability**: Uptime and error rates
- **Scalability**: Load handling
- **Stability**: No memory leaks or crashes

### Cleanup Evidence
- **Zero Dead Files**: Inventory complete
- **Zero Duplicates**: Consolidation complete
- **Quarantine**: Unused files moved
- **Deletion PR**: Post-soak cleanup ready

## Beta Launch Readiness

### Technical Readiness
- [ ] All tests passing
- [ ] Performance budgets met
- [ ] Security checklist complete
- [ ] Documentation frozen
- [ ] Export functionality verified

### Operational Readiness
- [ ] Monitoring configured
- [ ] Alerts configured
- [ ] Runbook complete
- [ ] Incident response ready
- [ ] Rollback procedure tested

### Quality Readiness
- [ ] Determinism proven
- [ ] Fallback rate acceptable
- [ ] Error handling robust
- [ ] User experience smooth
- [ ] Evidence collected

## Final Checklist

### Pre-Launch (24h before)
- [ ] Staging soak complete
- [ ] Performance budgets met
- [ ] Security sweep complete
- [ ] Documentation frozen
- [ ] Evidence pack complete

### Launch Day
- [ ] Final smoke test
- [ ] Performance baseline
- [ ] Monitoring active
- [ ] Alerts configured
- [ ] Team ready

### Post-Launch (24h after)
- [ ] Performance monitoring
- [ ] Error rate monitoring
- [ ] User feedback collection
- [ ] Issue tracking
- [ ] Success metrics
