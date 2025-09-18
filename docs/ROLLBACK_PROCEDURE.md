# 🚨 Astradio vNext Rollback Procedure

## One-Line Rollback Commands

### Emergency Rollback (Immediate)
```bash
# Disable canary and force V1
export STUDENT_V2_CANARY=false
export STUDENT_MODEL=v1
```

### Header Override (Per-Request)
```bash
# Force V1 for specific requests
curl -H "X-Student-Model: v1" /api/vnext/compose

# Force V2 for specific requests  
curl -H "X-Student-Model: v2" /api/vnext/compose
```

### Environment-Based Rollback
```bash
# Development environment (safe)
export QUALITY_ENV=development
export STUDENT_V2_CANARY=false

# Pre-production environment (after V2 proves stable)
export QUALITY_ENV=pre-production
export STUDENT_V2_CANARY=true
export CANARY_PERCENT=25

# Production environment (final)
export QUALITY_ENV=production
export STUDENT_V2_CANARY=true
export CANARY_PERCENT=100
```

## Automatic Rollback Triggers

The system automatically rolls back when any of these thresholds are breached:

### Development (Current)
- **Pass Rate Drop**: >5pp
- **Quality Drop**: >0.03
- **Error Rate Increase**: >2pp
- **Latency Increase**: >100ms

### Pre-Production (Phase 2C)
- **Pass Rate Drop**: >4pp
- **Quality Drop**: >0.025
- **Error Rate Increase**: >1.5pp
- **Latency Increase**: >80ms

### Production (Final)
- **Pass Rate Drop**: >3pp
- **Quality Drop**: >0.02
- **Error Rate Increase**: >1pp
- **Latency Increase**: >50ms

## Manual Rollback Steps

### 1. Immediate Response
```bash
# Stop canary immediately
export STUDENT_V2_CANARY=false

# Restart server if needed
npm restart
```

### 2. Investigation
```bash
# Check monitoring logs
tail -f logs/daily-monitoring.json

# Run daily monitoring script
npm run vnext:monitor

# Check canary telemetry
npm run vnext:telemetry
```

### 3. Root Cause Analysis
```bash
# Compare models on frozen evaluation set
npm run vnext:compare

# Check per-bucket performance
npm run vnext:bucket-analysis

# Validate calibration
npm run vnext:calibrate-check
```

### 4. Recovery Actions
```bash
# If calibration issue, re-calibrate
npm run vnext:calibrate-v2

# If model issue, retrain
npm run vnext:train-v2

# If adapter issue, update adapter
npm run vnext:update-adapter
```

## Monitoring & Alerting

### Key Metrics to Watch
1. **Pass Rate by Sun Sign**: 12 buckets
2. **Quality Score Trends**: Overall and per-bucket
3. **Melodic Scores**: Arc and motif (most sensitive)
4. **Latency P95**: Cold-start spikes
5. **Error Rate**: 422s and fallbacks

### Daily Monitoring
```bash
# Run daily monitoring (automated)
npm run vnext:monitor

# Check rollback status
npm run vnext:rollback-status

# View telemetry summary
npm run vnext:telemetry-summary
```

### Alerting Thresholds
- **Critical**: Any rollback trigger breached
- **Warning**: 80% of rollback threshold
- **Info**: Daily monitoring complete

## Rollback Verification

### 1. Confirm Rollback
```bash
# Check current model selection
curl -s /api/vnext/health | grep "model"

# Verify canary status
curl -s /api/vnext/canary-status
```

### 2. Performance Validation
```bash
# Run frozen evaluation set
npm run vnext:monitor

# Check all metrics are within bounds
npm run vnext:validate-performance
```

### 3. User Impact Assessment
```bash
# Check error rates
npm run vnext:error-analysis

# Monitor user complaints
npm run vnext:user-feedback
```

## Post-Rollback Actions

### 1. Immediate (0-1 hour)
- [ ] Confirm rollback successful
- [ ] Monitor error rates
- [ ] Check user experience
- [ ] Document incident

### 2. Short-term (1-24 hours)
- [ ] Root cause analysis
- [ ] Fix identified issues
- [ ] Update monitoring
- [ ] Communicate status

### 3. Long-term (1-7 days)
- [ ] Retrain model if needed
- [ ] Update calibration
- [ ] Improve monitoring
- [ ] Plan re-deployment

## Prevention Measures

### Before Deployment
- [ ] Run full test suite
- [ ] Validate on frozen evaluation set
- [ ] Check calibration accuracy
- [ ] Monitor pre-warm performance

### During Deployment
- [ ] Start with 10% canary
- [ ] Monitor all metrics closely
- [ ] Have rollback ready
- [ ] Document all changes

### After Deployment
- [ ] Daily monitoring
- [ ] Per-bucket analysis
- [ ] User feedback collection
- [ ] Continuous improvement

## Emergency Contacts

### Development Team
- **Primary**: Development lead
- **Secondary**: ML engineer
- **Escalation**: Technical director

### Operations Team
- **Monitoring**: DevOps engineer
- **Infrastructure**: Systems engineer
- **On-call**: Rotation schedule

## Recovery Time Objectives

- **Detection**: <5 minutes
- **Rollback**: <1 minute
- **Recovery**: <15 minutes
- **Full Resolution**: <4 hours

## Testing Rollback Procedure

### Monthly Test
```bash
# Simulate rollback scenario
npm run vnext:test-rollback

# Verify all steps work
npm run vnext:validate-rollback

# Document any issues
npm run vnext:rollback-report
```

### Quarterly Review
- Update thresholds based on performance
- Review and update procedures
- Train team on new processes
- Update documentation

---

**Remember**: Fast rollback is better than perfect diagnosis. When in doubt, roll back first and investigate second.
