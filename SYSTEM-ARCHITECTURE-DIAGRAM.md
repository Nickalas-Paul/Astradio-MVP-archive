# Astradio System Architecture Diagram

## High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              ASTRADIO SYSTEM ARCHITECTURE                      │
│                                   Phase-3 Audit                                │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CLIENT UI     │    │   NEXT.JS       │    │   EXPRESS       │    │   VNEXT ENGINE  │
│   (Browser)     │    │   (Frontend)    │    │   (Middleware)  │    │   (ML Engine)   │
│                 │    │                 │    │                 │    │                 │
│ • Wheel Canvas  │◄──►│ • React UI      │◄──►│ • API Routes    │◄──►│ • Compose API   │
│ • Audio Player  │    │ • Input Forms   │    │ • Swiss Ephem.  │    │ • Text Explainer│
│ • Controls      │    │ • State Mgmt    │    │ • Rate Limiting │    │ • Plan Generator│
│ • Visualization │    │ • Audio Engine  │    │ • Health Checks │    │ • Audition Gates│
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │                       │
         │                       │                       │                       │
         ▼                       ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   EXTERNAL      │    │   STATIC        │    │   DATABASE      │    │   ML MODELS     │
│   SERVICES      │    │   ASSETS        │    │   LAYER         │    │   & CACHE       │
│                 │    │                 │    │                 │    │                 │
│ • Geolocation   │    │ • CSS/JS        │    │ • PostgreSQL    │    │ • TensorFlow    │
│ • Nominatim     │    │ • Images        │    │ • Redis Cache   │    │ • Model Files   │
│ • Timezone APIs │    │ • Audio Files   │    │ • File Storage  │    │ • Feature Cache │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DATA FLOW ARCHITECTURE                            │
└─────────────────────────────────────────────────────────────────────────────────┘

INPUT LAYER
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   USER INPUT    │    │   GEOLOCATION    │    │   DATE/TIME     │
│                 │    │                 │    │                 │
│ • Date/Time     │    │ • GPS Coords     │    │ • Timezone      │
│ • Location      │    │ • IP Geolocation │    │ • UTC Conversion│
│ • Preferences   │    │ • Reverse Geo    │    │ • Julian Day    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                    ┌─────────────────────────┐
                    │    SWISS EPHEMERIS      │
                    │                         │
                    │ • Planet Positions      │
                    │ • House Calculations     │
                    │ • Aspect Analysis        │
                    │ • Moon Phase            │
                    └─────────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │    FEATURE ENCODER       │
                    │                         │
                    │ • 6D Feature Vector     │
                    │ • Astrological Context  │
                    │ • Control Surface       │
                    │ • Hash Generation       │
                    └─────────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │    VNEXT ML ENGINE      │
                    │                         │
                    │ • Plan Generation       │
                    │ • Audition Gates        │
                    │ • Text Explanation      │
                    │ • Audio Synthesis       │
                    └─────────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │    OUTPUT LAYER          │
                    │                         │
                    │ • Audio URL             │
                    │ • Text Explanation      │
                    │ • Visualization Data    │
                    │ • Telemetry Metrics     │
                    └─────────────────────────┘
```

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              PIPELINE ARCHITECTURE                             │
└─────────────────────────────────────────────────────────────────────────────────┘

CHART DATA PIPELINE
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   INPUT     │───►│   SWISS     │───►│   FEATURE   │───►│   CONTROL   │
│   VALIDATION│    │   EPHEMERIS │    │   ENCODER   │    │   SURFACE   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘

AUDIO PIPELINE
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   COMPOSE   │───►│   PLAN       │───►│   TONE.JS   │───►│   PLAYBACK  │
│   REQUEST   │    │   GENERATOR  │    │   ENGINE    │    │   CONTROL   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘

TEXT PIPELINE
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   CONTROL   │───►│   ATOMS     │───►│   TEXT      │───►│   EXPLANATION│
│   SURFACE   │    │   GENERATOR │    │   REALIZER  │    │   OUTPUT    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘

VIZ PIPELINE
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   CHART     │───►│   WHEEL     │───►│   CANVAS    │───►│   USER      │
│   DATA      │    │   RENDERER  │    │   DISPLAY   │    │   INTERFACE │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

## API Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              API ARCHITECTURE                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   NEXT.JS       │    │   EXPRESS       │    │   VNEXT         │
│   API ROUTES    │    │   MIDDLEWARE    │    │   COMPOSE API   │
│                 │    │                 │    │                 │
│ • /api/compose  │───►│ • Rate Limiting │───►│ • ComposeAPI    │
│ • /api/charts   │    │ • CORS          │    │ • TextExplainer │
│ • /api/health   │    │ • Security      │    │ • PlanGenerator │
│ • /api/readyz   │    │ • Validation    │    │ • AuditionGate  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CLIENT        │    │   DATABASE      │    │   ML MODELS     │
│   RESPONSES     │    │   LAYER         │    │   & CACHE       │
│                 │    │                 │    │                 │
│ • JSON          │    │ • PostgreSQL    │    │ • TensorFlow    │
│ • Error Codes   │    │ • Redis         │    │ • Model Files   │
│ • Status Codes  │    │ • File Storage  │    │ • Feature Cache │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Security Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              SECURITY ARCHITECTURE                             │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CLIENT        │    │   EXPRESS       │    │   VNEXT         │
│   SECURITY      │    │   MIDDLEWARE    │    │   SECURITY      │
│                 │    │                 │    │                 │
│ • HTTPS         │    │ • Helmet        │    │ • Input         │
│ • CORS          │    │ • Rate Limiting │    │   Validation    │
│ • CSP           │    │ • XSS Clean     │    │ • Sanitization  │
│ • Auth Headers  │    │ • HPP           │    │ • Gate Checks   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   EXTERNAL      │    │   DATABASE      │    │   MONITORING    │
│   SECURITY      │    │   SECURITY      │    │   & LOGGING     │
│                 │    │                 │    │                 │
│ • API Keys      │    │ • Connection    │    │ • Audit Logs    │
│ • Rate Limits   │    │   Encryption    │    │ • Health Checks │
│ • Geolocation   │    │ • Query         │    │ • Error Tracking│
│   Validation    │    │   Sanitization  │    │ • Performance   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Component Status Matrix

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              COMPONENT STATUS MATRIX                           │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┬─────────────┬─────────────┬─────────────────────────────────┐
│   COMPONENT     │   STATUS    │   HEALTH    │   NOTES                         │
├─────────────────┼─────────────┼─────────────┼─────────────────────────────────┤
│ Frontend UI     │ ✅ PASS     │ Healthy     │ React components functional     │
│ Express Server  │ ✅ PASS     │ Healthy     │ All routes operational          │
│ vNext Engine    │ ✅ PASS     │ Healthy     │ ML pipeline working             │
│ Swiss Ephemeris │ ✅ PASS     │ Healthy     │ Astrological calculations       │
│ Text Explainer  │ ✅ PASS     │ Healthy     │ Explanation generation working  │
│ Audio Engine    │ ✅ PASS     │ Healthy     │ Tone.js integration functional  │
│ Health Checks   │ ✅ PASS     │ Healthy     │ All probes passing              │
│ Rate Limiting   │ ✅ PASS     │ Healthy     │ Request throttling active       │
│ Error Handling  │ ✅ PASS     │ Healthy     │ Consistent error responses      │
│ Caching Layer   │ ✅ PASS     │ Healthy     │ Redis and memory caches working │
└─────────────────┴─────────────┴─────────────┴─────────────────────────────────┘
```

## Quality Gates Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              QUALITY GATES ARCHITECTURE                        │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   INPUT         │    │   AUDITION      │    │   OUTPUT        │
│   VALIDATION    │    │   GATES         │    │   VALIDATION    │
│                 │    │                 │    │                 │
│ • Schema Check  │───►│ • Melody Arc    │───►│ • Quality Score │
│ • Range Check   │    │ • Step-Leap     │    │ • Pass/Fail     │
│ • Type Check    │    │ • Narrative     │    │ • Error Codes   │
│ • Required      │    │ • Rhythm        │    │ • Suggestions   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CALIBRATED     │    │   STRICT        │    │   FAIL-CLOSED   │
│   THRESHOLDS    │    │   THRESHOLDS    │    │   DESIGN        │
│                 │    │                 │    │                 │
│ • Lower bounds  │    │ • Higher bounds  │    │ • Safe defaults │
│ • User friendly │    │ • Production    │    │ • Error handling│
│ • Hints/suggest │    │ • Quality focus  │    │ • Graceful fail │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

*Architecture diagrams generated for Phase-3 Audit - December 2024*
