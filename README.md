# KC3

KC3 is a planned app for finding third places in the Kansas City metro area.

## Status

- Stage: Product definition / initial backend implementation
- Current focus: Review the approved MVP data-model migration while the remaining
  application scope is defined.
- Last major milestone: Approved the KC3 MVP place data model.

## Quick Start

The repository currently contains product and engineering documentation plus the
initial Supabase schema migration. There is no client application to install,
build, or run yet.

See [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) for the development workflow and
the setup information that still needs to be established during scaffolding.

## Project Documentation

- [`docs/PRODUCT.md`](docs/PRODUCT.md) — product purpose, users, scope, and requirements
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — technical structure and major system choices
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — important decisions and why they were made
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — completed, current, and planned work
- [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) — local development, testing, deployment, and conventions
- [`AGENTS.md`](AGENTS.md) — standing instructions for AI coding agents

## Repository Structure

```text
KC3/
├── README.md
├── AGENTS.md
├── docs/
│   ├── PRODUCT.md
│   ├── ARCHITECTURE.md
│   ├── DECISIONS.md
│   ├── ROADMAP.md
│   └── DEVELOPMENT.md
├── supabase/
│   ├── config.toml
│   └── migrations/
└── LICENSE
```

Client application and test directories will be documented after the Expo project
is scaffolded. Their structure is not yet decided.

## Working Rule

The repository is the source of truth. Important product, technical, and architectural knowledge should be written into the repository rather than existing only in an AI conversation.
