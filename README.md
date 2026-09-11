# Astradio — Astrological Music Generation Platform

Full-stack generative AI application that translates astronomical ephemeris data into real-time audio compositions, deployed across web and Android (Google Play Store).

## What This Is

A production application that takes planetary position data from the Swiss Ephemeris, maps it to musical parameters (key, tempo, timbre, harmonic relationships), and generates audio in real time. Users input birth data or select celestial events, and the system produces unique compositions grounded in actual astronomical calculations — not randomized generative output. The platform includes user accounts, content moderation, community features, and was operated as a registered LLC.

## Architecture

| Layer | Technology |
|---|---|
| Frontend | Next.js (web), React Native / Expo (Android) |
| API Server | Express.js on Node.js |
| Audio Engine | Custom synthesis pipeline — astronomical data → musical parameter mapping → real-time audio generation |
| Visualization | WebGL for celestial body rendering and interactive star charts |
| Database | PostgreSQL |
| AWS AI Services | Rekognition (profile photo content moderation), Textract, Comprehend |
| Infrastructure | Render (API + Postgres), Vercel (web frontend), Google Play Store (Android) |

## Key Engineering Decisions

- **Deterministic output from astronomical input.** Compositions are derived from actual planetary positions, not stochastic generation. The same input data always produces the same musical output — a deliberate design constraint that required structured state management throughout the pipeline.
- **Spec pinning.** The system enforces a UnifiedSpecV1.1 contract between the API and audio engine. Requests that don't match the spec are rejected (fail-closed), preventing silent drift between components.
- **Evidence-first testing.** 24-hour soak testing with JSONL logs and HAR capture on failures. Thresholds: error rate ≤1%, fallback rate ≤2%, compose P95 ≤1800ms, audio P95 ≤2500ms.
- **Content moderation in production.** AWS Rekognition integrated for user-uploaded profile photos — a real-world implementation of AWS AI services within a production content pipeline.

## CI/CD & Quality

- GitHub Actions workflows for E2E testing, endpoint validation, and 24-hour soak runs
- Determinism testing via back-to-back requests verifying identical output
- Rate-limited soak runner (≤1 RPS) for staging-friendly operation
- 30-day artifact retention with automatic issue creation on threshold failures

## Project Status

Production application operated from October 2024 through mid-2026. Web and Android clients shipped. Infrastructure decommissioned (Render, Vercel, Play Store listing) — codebase preserved as a portfolio reference and engineering case study. This repository represents the clean production codebase migrated from the original MVP.
