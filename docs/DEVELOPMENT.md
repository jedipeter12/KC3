# Development

## Prerequisites

Application prerequisites are not yet known because the Expo project has not been
scaffolded. Do not infer tool versions or package managers. At present, only Git is
needed to work with the documentation repository. Running the database tests also
requires Node.js with npm and a Docker-compatible container runtime for the local
Supabase stack.

- Git
- Node.js with npm: Required for the repository-pinned Supabase CLI. Exact project
  versions remain to be selected during application scaffolding.
- Docker-compatible container runtime: Required by local Supabase commands.
- Expo and platform tooling: To be selected and documented during scaffolding.

## Initial Setup

There is currently no application setup procedure. Add exact, verified commands
after scaffolding; do not leave example commands that appear runnable.

## Running Locally

Not available until the application is scaffolded.

## Building

Not available until the application is scaffolded.

## Testing

### Database Tests

The approved PostgreSQL data model is tested with pgTAP through the repository's
Supabase CLI dependency. From the repository root:

1. Start the local Supabase services with `npm exec -- supabase start`.
2. Rebuild the local database from migrations with
   `npm exec -- supabase db reset`.
3. Run the database tests with `npm test`.

Database reset automatically runs `supabase/seed.sql` after migrations. The seed
is transactional and safe to run again against the same database. It adds missing
stable seed records and unknown KC3 detail shells but does not overwrite existing
canonical or KC3-curated fields. It intentionally leaves Google-owned fields and
weekly hours empty. See `SEED_DATA.md` for the dataset and maintenance rules.

The tests live in `supabase/tests/`. They execute inside transactions and roll
their fixture data back. The suite covers schema shape, approved enum values,
required canonical fields, defaults and unknown values, one-to-one ownership,
cascading deletion, weekly-hours validation, split and overnight intervals,
automatic update timestamps, the local MVP seed contract, and the
closed-by-default RLS configuration.

Run PostgreSQL lint checks against the same local database with
`npm run lint:db`. The command targets KC3's `public` schema and fails on project
warnings; it excludes third-party extension internals installed by the test suite.

### Application Unit Tests

No application unit-test framework or command has been selected because no client
application exists yet.

### API / UI Tests

No API or UI test framework or command has been selected. Database migration
tests are the only applicable integration tests at the current project stage.

## Linting / Formatting

The Supabase CLI's PostgreSQL lint command is available as `npm run lint:db`.
Application linting and formatting tools have not been selected because the Expo
application has not been scaffolded.

## Environment Variables / Secrets

Never commit production secrets to the repository.

Document required variable names without including their secret values.

No environment variable names are confirmed yet. Document the exact public client
configuration and server-side secrets required by Supabase during scaffolding.
Never place secret values in documentation, source control, or client-exposed
configuration.

The repository ignores common environment, signing-key, Expo/EAS local-state,
keystore, and mobile-provisioning files as an accident-prevention measure. Ignore
rules do not replace secret scanning or platform secret management.

## Branching / Git Workflow

- Keep `main` in a reviewable state.
- Create a focused branch for non-trivial work.
- Use descriptive, focused commits and do not mix unrelated changes.
- Do not push, merge, or otherwise modify remote state unless the specific task
  authorizes it.

## Roles and Delivery Workflow

- The user is the Product Owner and approves product behavior and scope.
- ChatGPT may act as PM, architect, and technical translator to turn product intent
  into repository documentation and scoped tickets.
- Codex acts as developer for approved tickets: read repository guidance, make the
  smallest in-scope change, run appropriate checks, and report results.
- Use this flow:
  `idea or decision → repository documentation → scoped Codex ticket → implementation and tests → Product Owner review`.
- `ROADMAP.md` is the PM backlog and should reflect work that is started,
  completed, deferred, or reprioritized.
- Autonomous multi-agent orchestration is not required for the initial workflow.

## Ticket Completion Checklist

Each implementation ticket should direct the developer to:

1. Read `AGENTS.md`, `README.md`, and the relevant files in `docs/`.
2. Confirm the requested behavior is approved and scoped.
3. Avoid unrelated changes and preserve existing behavior.
4. Add or update tests when behavior changes.
5. Run the relevant tests and build checks.
6. Update affected documentation.
7. Report changed files, checks run, and remaining risks or follow-up work.

## Development Conventions

- Language: Write new application logic in TypeScript. JavaScript may remain where
  tooling requires it.
- File organization: Follow the scaffolded project structure once it exists; do
  not invent a parallel structure without a documented reason.
- Error handling: Follow established project patterns once defined.
- Logging: Do not log credentials or sensitive data; a broader strategy is not yet
  defined.
- Dependency policy: Prefer existing dependencies and patterns. Add a dependency
  only for a clear, documented reason.
- Database access: Keep Data API grants and RLS policies in versioned migrations
  and add role-focused database tests in the same change that opens access.
- Privileged credentials: Never place a Supabase secret/service-role key or direct
  database credential in an Expo, Expo Web, or other client bundle.

## Deployment / Release Process

No deployment or release process exists yet. Document exact, verified steps after
hosting and release tooling are selected.

## Troubleshooting

No application-specific troubleshooting guidance exists yet.
