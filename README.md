# KC3

KC3 is a planned app for finding third places in the Kansas City metro area.

## Status

- Stage: Implemented real-data-driven place list/detail slice over the approved
  anonymous public contract and refresh-verified local MVP dataset
- Current focus: Complete the user-attended VoiceOver and TalkBack verification
  tracked in KC3-34 for the KC3-21/KC3-23 release gate.
- Latest milestone: KC3-33 exercises all 160 active records from a fresh bounded
  real-dataset run through summary, detail, and discovery paths; resolves
  evidence-backed presentation, navigation, filtering, and Maps resilience
  issues; and records broader data findings as non-blocking follow-up work.

KC3-23 final automated checks and live Expo Web and iOS Simulator functional
smoke checks pass. Milestone closure remains pending native accessibility
verification; see
[`docs/MVP_VERIFICATION.md`](docs/MVP_VERIFICATION.md).

## Quick Start

The repository contains the Expo client scaffold, product and engineering
documentation, the Supabase schema and public-read migrations, a local MVP seed,
and a manual server-side Google Places ingestion CLI. Use Node.js 24.20.0 and npm
11.19.0, then run `npm install` and `npm start`.
Use `npm run web`, `npm run ios`, or `npm run android` for a specific supported
target.

See [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) for the development workflow and
the public environment configuration required to run the client.

## Project Documentation

- [`docs/PRODUCT.md`](docs/PRODUCT.md) — product purpose, users, scope, and requirements
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — technical structure and major system choices
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — important decisions and why they were made
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — completed, current, and planned work
- [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) — local development, testing, deployment, and conventions
- [`docs/SECURITY_REVIEW.md`](docs/SECURITY_REVIEW.md) — current defensive security assessment and pre-launch requirements
- [`docs/TESTING_REVIEW.md`](docs/TESTING_REVIEW.md) — database coverage review, remaining gaps, and decisions required
- [`docs/SEED_DATA.md`](docs/SEED_DATA.md) — local seed behavior, data provenance, and maintenance rules
- [`docs/GOOGLE_INGESTION_CONTRACT.md`](docs/GOOGLE_INGESTION_CONTRACT.md) — approved Google field, ownership, normalization, refresh, and override rules
- [`docs/KC3_27_DATASET.md`](docs/KC3_27_DATASET.md) — bounded MVP dataset run record, counts, review findings, and coverage limitations
- [`docs/KC3_28_VERIFICATION.md`](docs/KC3_28_VERIFICATION.md) — repeat import, ownership, timestamp, anonymous integration, and real-data UI verification record
- [`docs/KC3_29_PLACE_EXPERIENCE.md`](docs/KC3_29_PLACE_EXPERIENCE.md) — approved real-data-driven list, detail, field, state, responsive, and accessibility contract
- [`docs/KC3_30_PUBLIC_PLACE_CONTRACT.md`](docs/KC3_30_PUBLIC_PLACE_CONTRACT.md) — implemented expanded anonymous summary/detail data, freshness, compatibility, and authorization contract
- [`docs/KC3_31_IMPLEMENTATION.md`](docs/KC3_31_IMPLEMENTATION.md) — implemented list/detail UI, verification evidence, and remaining native checks
- [`docs/KC3_33_AUDIT.md`](docs/KC3_33_AUDIT.md) — full real-dataset audit, resolved issues, record coverage, and bounded follow-ups
- [`AGENTS.md`](AGENTS.md) — standing instructions for AI coding agents

## Repository Structure

```text
KC3/
├── README.md
├── AGENTS.md
├── app.json
├── index.ts
├── package.json
├── tsconfig.json
├── scripts/
├── src/
│   ├── App.tsx
│   ├── config/
│   ├── data/
│   ├── features/
│   ├── lib/
│   └── types/
├── tests/
├── docs/
│   ├── PRODUCT.md
│   ├── ARCHITECTURE.md
│   ├── DECISIONS.md
│   ├── ROADMAP.md
│   ├── DEVELOPMENT.md
│   ├── SEED_DATA.md
│   ├── SECURITY_REVIEW.md
│   └── TESTING_REVIEW.md
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   ├── seed.sql
│   └── tests/
└── LICENSE
```

Database tests are documented in [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).
Application source lives in `src/`, application tests live in `tests/`, and the
root `index.ts` registers the React Native application with Expo.

## Working Rule

The repository is the source of truth. Important product, technical, and architectural knowledge should be written into the repository rather than existing only in an AI conversation.
