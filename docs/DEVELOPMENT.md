# Development

## Prerequisites

Use the versions recorded by `.nvmrc`, `package.json`, and `package-lock.json`:

- Git.
- Node.js 24.20.0 LTS. Run `nvm use` when using nvm.
- npm 11.19.0. npm and the committed npm lockfile are the selected package
  manager and dependency lock.
- Docker-compatible container runtime: Required by local Supabase commands.
- Expo Go or the relevant Android/iOS simulator tooling when running a mobile
  development target. Expo Web requires a supported local browser.

## Initial Setup

From the repository root:

1. Select Node.js 24.20.0 with your version manager (`nvm use` when using nvm).
2. Confirm npm 11.19.0 with `npm --version`.
3. Install the locked dependencies with `npm install`.

The Expo application requires no environment variables until the Supabase client
configuration ticket establishes the public variable names.

## Running Locally

Run `npm start` to launch Expo's development server. Use a target-specific command
when preferred:

- `npm run web`
- `npm run ios`
- `npm run android`

The iOS and Android commands require a compatible simulator or connected device.

## Building

Run `npm run export` to create production bundles for Web, iOS, and Android in the
ignored `dist/` directory. This validates bundling but is not a signed native app
build or deployment.

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
automatic update timestamps, the local MVP seed contract, and the anonymous
public place RPC's role, RLS, column, status, and write-denial boundaries.

Run PostgreSQL lint checks against the same local database with
`npm run lint:db`. The command targets KC3's `public` schema and fails on project
warnings; it excludes third-party extension internals installed by the test suite.

### Application Unit Tests

Run `npm run test:app` for the Jest application suite. Jest uses the `jest-expo`
preset, application tests live in `tests/`, and the initial smoke test protects
the shared application identity configuration.

### API / UI Tests

The approved Supabase RPC authorization behavior is tested at the PostgreSQL role
level with pgTAP. No client-level API or UI test framework or command has been
selected. Database migration tests are the only applicable integration tests at
the current project stage.

## Linting / Formatting

- `npm run typecheck` runs strict TypeScript checking without emitting files.
- `npm run lint` runs Expo's supported ESLint flat configuration over application
  and tooling source while ignoring generated Expo and local Supabase artifacts.
- `npm run format:check` verifies Prettier formatting.
- `npm run format` writes Prettier formatting to application and configuration
  files.
- `npm run lint:db` runs the Supabase CLI's PostgreSQL lint command.

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

### Project Tracking

`docs/ROADMAP.md` remains the source of truth for KC3 priorities, scope, and
status. The [KC3 Work/Tickets Notion database](https://app.notion.com/p/peterthompson/3c135ab73db3801b99d5cfc6cbcb5dac?v=a9135ab73db383c59d63082f5b376522)
is the execution tracker for detailed tickets, acceptance criteria, dependencies,
and progress notes.

Keep the Notion tracker synchronized with roadmap changes, but resolve any
conflict in favor of the repository. For KC3 work, access only that directly
linked Notion database and its ticket pages; do not search or inspect unrelated
Notion workspace content. Fetch the database schema before creating or updating
tickets so property names and options remain accurate. No Notion credentials or
tokens belong in the repository.

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
- Public place reads: Unauthenticated clients may execute only
  `public.list_public_places()`. Do not query the base tables from client code or
  broaden the returned fields without an approved migration and matching tests.
- Privileged credentials: Never place a Supabase secret/service-role key or direct
  database credential in an Expo, Expo Web, or other client bundle.

## Deployment / Release Process

No deployment or release process exists yet. Document exact, verified steps after
hosting and release tooling are selected.

## Troubleshooting

No application-specific troubleshooting guidance exists yet.
