# KC3

KC3 is a planned app for finding third places in the Kansas City metro area.

## Status

- Stage: Product definition / initial backend implementation
- Current focus: Review the anonymous active-place access boundary while the
  remaining Expo client MVP is defined.
- Last major milestone: Added, reviewed, and merged the ownership-safe local MVP
  place seed.

## Quick Start

The repository currently contains product and engineering documentation, the
Supabase schema and public-read migrations, and a local MVP seed. There is no
client application to install, build, or run yet.

See [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) for the development workflow and
the setup information that still needs to be established during scaffolding.

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
├── package.json
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
Client application and application-test directories will be documented after the
Expo project is scaffolded. Their structure is not yet decided.

## Working Rule

The repository is the source of truth. Important product, technical, and architectural knowledge should be written into the repository rather than existing only in an AI conversation.
