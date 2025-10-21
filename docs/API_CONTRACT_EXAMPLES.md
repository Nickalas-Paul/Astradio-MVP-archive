# Astradio API Contract Examples

## Unified Spec v1.1 Response Format

All `/api/compose` responses follow this structure:

```json
{
  "controls": { /* ControlSurfacePayload */ },
  "astro": { /* Astrological summary */ },
  "gate_report": { /* Quality gates */ },
  "audio": { /* Audio payload */ },
  "text": { /* Raw text blocks */ },
  "explanation": { /* Unified Spec v1.1 format */ },
  "viz": { /* Visualization payload or null */ },
  "hashes": { /* Deterministic hashes */ },
  "artifacts": { /* Model provenance */ }
}
```

## Case A: Audio URL Mode (Current Implementation)

**Request:**
```json
{
  "date": "1990-01-01",
  "time": "12:00",
  "location": "New York",
  "geo": {
    "lat": 40.7128,
    "lon": -74.0060
  }
}
```

**Response:**
```json
{
  "controls": {
    "arc_shape": 0.45,
    "density_level": 0.6,
    "tempo_norm": 0.7,
    "step_bias": 0.7,
    "leap_cap": 5,
    "rhythm_template_id": 3,
    "syncopation_bias": 0.3,
    "motif_rate": 0.6,
    "element_dominance": "air",
    "aspect_tension": 0.4,
    "modality": "mutable",
    "hash": "247f29c5"
  },
  "astro": {
    "element_dominance": "air",
    "aspect_tension": 0.4,
    "modality": "mutable"
  },
  "gate_report": {
    "calibrated": {
      "melody_arc": true,
      "melody_step_leap": true,
      "melody_narrative": true,
      "rhythm_diversity": true,
      "overall": true
    },
    "strict": {
      "melody_arc": false,
      "melody_step_leap": false,
      "melody_narrative": false,
      "rhythm_diversity": false,
      "overall": false
    },
    "scores": {
      "melody_arc": 0.45,
      "melody_step_leap": 0.22,
      "melody_narrative": 0.42,
      "rhythm_diversity": 0.30
    },
    "latency_ms": {
      "predict": 2.5,
      "plan": 1.2,
      "total": 8.7
    }
  },
  "audio": {
    "url": "/api/audio/247f29c5.mp3",
    "digest": "sha256:b88e5d7044a6d2dc99df2eedfbd96fbb7479a5e245dd7c190223339fe4335ffb",
    "latency_ms": 57.8325
  },
  "text": {
    "blocks": [
      {
        "type": "short",
        "content": "Tone: social, well-proportioned. Venus and Earth guide mostly connected motion, with Jupiter's expansive reach."
      },
      {
        "type": "long", 
        "content": "Tone: social, well-proportioned. Venus and Earth guide mostly connected motion, with Jupiter's expansive reach. Mercury's lightly shifting patterns, with subtle celestial shifts. measured, Jupiter-steady tempo planetary influences balance with cosmic clarity Jupiter's rhythm of growth cycles..."
      },
      {
        "type": "bullets",
        "content": ["Venus guides connected motion", "Jupiter's expansive reach", "Mercury's shifting patterns"]
      }
    ],
    "digest": "sha256:63525667c65d49438e3148b68732d82803357e999a026ec7814d02a48da3ec7f"
  },
  "explanation": {
    "spec": "UnifiedSpecV1.1",
    "sections": [
      {
        "title": "Theme",
        "text": "Tone: social, well-proportioned. Venus and Earth guide mostly connected motion, with Jupiter's expansive reach."
      },
      {
        "title": "Details", 
        "text": "Tone: social, well-proportioned. Venus and Earth guide mostly connected motion, with Jupiter's expansive reach. Mercury's lightly shifting patterns, with subtle celestial shifts. measured, Jupiter-steady tempo planetary influences balance with cosmic clarity Jupiter's rhythm of growth cycles..."
      },
      {
        "title": "Bullets",
        "text": "Venus guides connected motion · Jupiter's expansive reach · Mercury's shifting patterns"
      }
    ]
  },
  "viz": {
    "url": "https://cdn.astradio.io/viz/abc123def456.json",
    "digest": "sha256:abc123def456789"
  },
  "hashes": {
    "control": "sha256:7ba3cf9b67c4e6acb14efb247749f425426a7531f7c4f719a41d60b51465c40d",
    "audio": "sha256:b88e5d7044a6d2dc99df2eedfbd96fbb7479a5e245dd7c190223339fe4335ffb",
    "explanation": "sha256:63525667c65d49438e3148b68732d82803357e999a026ec7814d02a48da3ec7f",
    "viz": "sha256:abc123def456789"
  },
  "artifacts": {
    "model": "084c92dca9af2f09",
    "encoder": "db4eb96e52b3f63e",
    "chartHash": "mock_chart_hash",
    "featuresVersion": "v1.0",
    "snapset": "185371267270f0ef",
    "gate": "v2.3-final",
    "mapping_tables_version": "v1.1",
    "timestamp": "2025-10-02T21:59:49.652Z",
    "provenance": {
      "chartHash": "mock_chart_hash",
      "seed": "247f29c5",
      "featuresVersion": "v1.0",
      "modelVersions": {
        "audio": "student-v2.8-slice-batch",
        "text": "v1.1",
        "viz": "1.0",
        "matching": "v1.0"
      },
      "houseSystem": "placidus",
      "tzDiscipline": "utc"
    }
  }
}
```

## Case B: Audio Plan Mode (Future Implementation)

**Response (audio section only):**
```json
{
  "audio": {
    "plan": {
      "events": [
        {
          "time": 0.0,
          "type": "note",
          "pitch": 60,
          "duration": 0.5,
          "velocity": 0.7,
          "instrument": "piano"
        },
        {
          "time": 0.5,
          "type": "note", 
          "pitch": 64,
          "duration": 0.5,
          "velocity": 0.6,
          "instrument": "piano"
        }
      ],
      "tempo": 120,
      "timeSignature": "4/4",
      "key": "C major"
    },
    "digest": "sha256:plan_hash_here",
    "latency_ms": 12.5
  }
}
```

## Case C: Degraded Mode (No Audio)

**Response (audio section only):**
```json
{
  "audio": {
    "url": null,
    "plan": null,
    "error": "Audio generation failed: model unavailable",
    "digest": "sha256:error_hash",
    "latency_ms": 0
  }
}
```

## Audio Path Priority & Fallback

**URL Mode (Primary - Beta):**
- `audio.url` contains direct URL to generated audio file
- UI uses HTML5 `<audio>` element for playback
- If URL fetch/play fails, automatically falls back to plan mode
- Preferred for Beta due to simplicity and reliability

**Plan Mode (Fallback):**
- `audio.plan` contains structured event data
- UI uses Tone.js to synthesize audio from plan
- Used when URL generation fails or is unavailable
- Provides deterministic audio generation from astrological data

## Determinism Requirements

- Same input parameters → identical `hashes.control`
- Same input parameters → identical `hashes.audio` 
- Same input parameters → identical `hashes.explanation`
- All hashes must be SHA256 format: `sha256:hex_string`

## Error Responses

**400 Bad Request:**
```json
{
  "error": "Invalid input",
  "details": [
    {
      "field": "date",
      "message": "String must match regex /^\\d{4}-\\d{2}-\\d{2}$/"
    }
  ]
}
```

**429 Too Many Requests:**
```json
{
  "error": "Too many composition requests",
  "retryAfter": 900
}
```

**500 Internal Server Error:**
```json
{
  "error": "Compose API error: model unavailable",
  "code": "VNEXT_COMPOSE_ERROR"
}
```
