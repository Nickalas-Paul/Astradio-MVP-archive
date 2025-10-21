# Staging Soak Plan

## Overnight Monitoring (24h)

### Golden Chart Set (Hourly)
- **Frequency**: Every hour for 24 hours
- **Charts**: 5 golden charts per run
- **Metrics**: Compose latency, audio startup, fallback rate, error rate

### Monitoring Script
```powershell
# Run every hour
.\scripts\staging-validation.ps1 -StagingUrl "https://staging.astradio.io" -TestCount 5
```

### Alert Thresholds
- **Compose Latency P95**: > 200ms
- **Audio Startup P95**: > 100ms  
- **Fallback Rate**: > 2%
- **Error Rate**: > 1%
- **Readiness Failures**: Any

### Expected Results
- **Compose Latency**: P50 < 100ms, P95 < 200ms
- **Audio Startup**: P50 < 50ms, P95 < 100ms
- **Fallback Rate**: 0-2%
- **Error Rate**: 0-1%
- **Readiness**: 100% green

## Soak Test Cases

### Primary Test (Every Hour)
1. New York 1990-01-01 12:00
2. Los Angeles 1985-06-15 18:30  
3. London 1992-12-25 09:15
4. Tokyo 1988-03-20 14:45
5. Sydney 1991-08-10 21:30

### Edge Cases (Every 4 Hours)
1. Invalid date input
2. Rate limiting test
3. Large coordinate values
4. Future date
5. DST boundary

## Monitoring Dashboard

### Key Metrics
- **Compose Success Rate**: Target 100%
- **Audio Playback Rate**: Target 100%
- **Wheel Render Rate**: Target 100%
- **Text Generation Rate**: Target 100%

### Performance Budgets
- **Compose Latency**: P50 < 100ms, P95 < 200ms
- **Audio Startup**: P50 < 50ms, P95 < 100ms
- **Memory Usage**: < 512MB
- **CPU Usage**: < 50%

## Alert Configuration

### Critical Alerts
- Readiness endpoint down
- Compose API returning 5xx errors
- Fallback rate > 5%
- Error rate > 2%

### Warning Alerts  
- Compose latency P95 > 200ms
- Audio startup P95 > 100ms
- Memory usage > 512MB
- CPU usage > 50%

## Success Criteria

### ✅ Pass (24h)
- No critical alerts
- Fallback rate ≤ 2%
- Error rate ≤ 1%
- Latency within budgets
- Readiness 100% green

### ❌ Fail
- Any critical alerts
- Fallback rate > 2%
- Error rate > 1%
- Latency exceeds budgets
- Readiness failures

## Evidence Collection

### Hourly Logs
- Compose latency metrics
- Audio startup metrics
- Fallback rate
- Error rate
- Readiness status

### Daily Summary
- 24h performance summary
- Alert timeline
- Trend analysis
- Recommendations

## Rollback Plan

### If Critical Issues
1. Immediate rollback to previous version
2. Investigate root cause
3. Fix and redeploy
4. Resume soak testing

### If Performance Issues
1. Monitor for 2 hours
2. If persistent, investigate
3. Consider rollback if severe
4. Document findings

## Post-Soak Analysis

### Success Metrics
- **Uptime**: 100%
- **Performance**: Within budgets
- **Reliability**: No critical issues
- **Scalability**: Handles load

### Next Steps
- **If Pass**: Proceed to beta handoff
- **If Fail**: Investigate and fix
- **If Partial**: Address issues and retest
