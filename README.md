# KC3

KC3 is a planned app for finding third places in the Kansas City metro area.

## Status

- Stage: Initial client implementation
- Current focus: Add client-side name search and city/place-type filters to the
  public place list.
- Last major milestone: Implemented and verified the responsive public place
  list with loading, empty, sanitized error, and retry states.

## Quick Start

The repository contains the Expo client scaffold, product and engineering
documentation, the Supabase schema and public-read migrations, and a local MVP
seed. Use Node.js 24.20.0 and npm 11.19.0, then run `npm install` and `npm start`.
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
