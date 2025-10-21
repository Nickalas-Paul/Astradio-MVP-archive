# Staging Golden Chart Set

## Test Cases for Staging Validation

### Primary Golden Charts (10-20 tests)

```json
[
  {
    "name": "New York 1990",
    "date": "1990-01-01",
    "time": "12:00",
    "location": "New York",
    "geo": {"lat": 40.7128, "lon": -74.0060},
    "expected_hash": "sha256:7ba3cf9b67c4e6acb14efb247749f425426a7531f7c4f719a41d60b51465c40d"
  },
  {
    "name": "Los Angeles 1985",
    "date": "1985-06-15", 
    "time": "18:30",
    "location": "Los Angeles",
    "geo": {"lat": 34.0522, "lon": -118.2437}
  },
  {
    "name": "London 1992",
    "date": "1992-12-25",
    "time": "09:15", 
    "location": "London",
    "geo": {"lat": 51.5074, "lon": -0.1278}
  },
  {
    "name": "Tokyo 1988",
    "date": "1988-03-20",
    "time": "14:45",
    "location": "Tokyo", 
    "geo": {"lat": 35.6762, "lon": 139.6503}
  },
  {
    "name": "Sydney 1991",
    "date": "1991-08-10",
    "time": "21:30",
    "location": "Sydney",
    "geo": {"lat": -33.8688, "lon": 151.2093}
  }
]
```

## Validation Criteria

### ✅ Accept Criteria
- **100% golden charts render** audio/text/wheel
- **Hashes stable** across runs
- **Readiness green** (/health + /readyz)
- **Spec version**: UnifiedSpecV1.1
- **Audio URLs**: Non-null, accessible
- **Telemetry**: Visible in UI

### ❌ Reject Criteria  
- Any chart fails to render
- Hash mismatches between runs
- Readiness failures
- Silent fallbacks
- Missing telemetry

## Evidence Collection

### Required Evidence
1. **HAR files** for 3 golden charts (compose + audio)
2. **Screenshots** with visible controlHash/rendererHash
3. **Telemetry snapshot** before/after run
4. **Rate limit proof** (429 response)
5. **Fail-closed proof** (bad spec error)

### Staging URLs
- **Compose API**: `https://staging.astradio.io/api/compose`
- **Health**: `https://staging.astradio.io/health`
- **Readiness**: `https://staging.astradio.io/readyz`
