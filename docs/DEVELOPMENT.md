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
4. Copy `.env.example` to `.env.local` and set the two public Supabase values.

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
public place RPC's role, RLS, column, status, and write-denial boundaries. It also
covers Google ingestion storage constraints, move links, source-specific hours,
effective-dated overrides, and local-time override resolution.

Run PostgreSQL lint checks against the same local database with
`npm run lint:db`. The command targets KC3's `public` schema and fails on project
warnings; it excludes third-party extension internals installed by the test suite.

### Application Unit Tests

Run `npm run test:app` for the Jest application suite. Jest uses the `jest-expo`
preset and application tests live in `tests/`. The suite protects the shared
application identity and Supabase configuration, the exact public database type,
and the public-place data layer's ordered success, empty, malformed-response,
and sanitized provider-error behavior.

The public-place data layer calls only `list_public_places()`. A successful empty
RPC array returns `[]`; null or malformed data, provider errors, and rejected
requests throw the stable `PUBLIC_PLACES_UNAVAILABLE` application error without
including the underlying provider details.

React Native Testing Library component tests exercise the place-list screen's
loading, ordered results, four visible fields, derived filter choices, combined
search/filter interactions, database-empty and no-match states, local clearing,
sanitized error, and retry behavior. Pure unit tests protect name-query
normalization, AND semantics, derived choices, and order preservation. Screen
dependencies are injected only at the component boundary for focused testing;
production uses the approved public-place data operation.

`tests/google-contract.test.ts` protects the future importer contract without
calling Google: the exact field mask, deterministic cosmetic comparison,
100-meter material-location screening, missing-hours preservation, explicit
closed schedules, split and overnight intervals, 24/7 normalization, and invalid
schedule rejection. The authoritative workflow contract is
[`GOOGLE_INGESTION_CONTRACT.md`](GOOGLE_INGESTION_CONTRACT.md).

The generated client database type remains intentionally unchanged by KC3-24:
the new storage tables and internal override resolver are not public client APIs,
and `src/types/database.ts` still exposes exactly `list_public_places()`.

KC3-19 adds component regression cases for successful mixed-case name search,
independent city/type constraints, resetting one constraint while retaining the
others, selected button semantics, and ignoring extra runtime record fields.
Run these with the same `npm run test:app` command; no live Supabase instance or
environment configuration is required. These tests do not replace device,
browser, or screen-reader verification.

### API / UI Tests

Run `npm run test:integration` for the KC3-20 live client-to-RPC smoke suite.
Start Docker Desktop, run `npm exec -- supabase start`, and then run
`npm exec -- supabase db reset --local` to prepare the disposable local database.
Reset replaces local data; preserve any local curation before doing so. The test
itself only reads and does not start, reset, or mutate the database.

The separate Jest Node configuration uses real network requests and the production
typed Supabase client and data layer, without provider mocks. It obtains only the
local API URL and anonymous key from the installed CLI's captured status output,
requires a loopback endpoint, and overrides ambient Expo configuration. No manual
key copy, hosted project, or privileged client credential is required. CLI output
is never printed. Docker/CLI access failures produce prerequisite instructions.
Run it from the repository root with permission to access Docker and localhost.

The suite expects the unchanged 15-place seed, checks every seed ID and the raw
five-field response before data-layer projection, compares production data-layer
results, and requires HTTP 401 / PostgreSQL `42501` for direct `places` reads.
Missing migrations, seed changes, or API failures fail the suite; they are not
silently skipped. Run `npm test` and `npm run lint:db` against the same database
for the complementary 148 pgTAP assertions and schema lint. `test:app` remains
independent of Docker and excludes the `*.smoke.ts` integration files.

See [`ACCESSIBILITY_REVIEW.md`](ACCESSIBILITY_REVIEW.md) for the KC3-21 manual
viewport/keyboard results, accessibility fixes, and outstanding native,
large-text, and spoken screen-reader checks. Use `npm run test:app` for the
focused Web pressed-state and iOS announcement regression tests.

The approved Supabase RPC authorization behavior is tested at the PostgreSQL role
level with pgTAP and over the local Data API with the Jest smoke suite. Component
tests use React Native Testing Library. No end-to-end framework has been selected.

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

The Expo client requires:

- `EXPO_PUBLIC_SUPABASE_URL`: the Supabase project URL. Local Expo clients running
  on a physical device must use a URL reachable from that device rather than
  `127.0.0.1`.
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the project's public publishable key. A
  local or legacy public anonymous key may be used here when applicable.

Both values are intentionally public and Expo embeds them in the application
bundle. Their access is constrained by Supabase grants and RLS; they must not be
treated as authorization secrets. Copy `.env.example` to the ignored `.env.local`
file and fill in the values locally. The application reports missing or malformed
configuration by variable name without echoing the supplied values.

Never place a Supabase secret/service-role key, database password, connection
string, or other privileged credential in an `EXPO_PUBLIC_` variable, client
source, documentation, or source control.

The repository ignores common environment, signing-key, Expo/EAS local-state,
keystore, and mobile-provisioning files as an accident-prevention measure. Ignore
rules do not replace secret scanning or platform secret management.

## Continuous Integration

`.github/workflows/ci.yml` selects GitHub Actions. It runs on pull requests,
pushes to `main` and `codex/**` branches, and manual dispatch once available on
the default branch. Separate `Application checks` and `Database checks` jobs use
Ubuntu 24.04, Node.js from `.nvmrc`, npm 11.19.0, and `npm ci`. Supabase and all
application dependencies come from `package-lock.json`; the checkout and Node
setup actions are pinned to full commit SHAs. Update these pins deliberately.

The application job runs typecheck, lint, formatting, Jest tests, and Expo exports
for Web, iOS, and Android. Export uses inert public placeholder configuration and
does not call a hosted Supabase project. Exports are build verification only.

The database job starts a fresh local Supabase stack on the hosted Docker runner,
resets it with migrations and seed, runs pgTAP, database lint, and the live
client-to-RPC smoke suite, then stops the stack even after failure. Start output
suppresses the credential summary. Integration tests capture CLI status without
printing it and use only the local anonymous key. No repository secrets,
production credentials, hosted database, Expo login, or deployment are required.
Jobs have read-only repository permission and do not persist checkout credentials.

Any failing command fails its job; neither job permits check failures. Configure
both job names as required checks in GitHub branch rules if merge enforcement is
desired. A failed workflow alone does not configure branch protection. Older
runs for the same event/ref are cancelled when superseded. Branch pushes and PR
events can each run CI for an open `codex/**` branch.

### CI troubleshooting and validation

- Open the failed job and first failing step in GitHub Actions. Reproduce with
  the documented Node/npm versions and the same npm command.
- For install failures, check runtime pins and lockfile consistency; regenerate
  the lockfile intentionally rather than replacing `npm ci` with `npm install`.
- For Supabase startup failures, inspect the retained stderr for Docker image
  pulls, service health failures, or runner disk exhaustion. Retry transient
  registry failures. Locally, start Docker before following the database setup
  steps above. Do not print full CLI status or upload its credential output.
- For database/integration failures, verify migrations and the unchanged seed on
  a disposable reset database. Never substitute production connection values.
- For export failures, check the public placeholder variables and Metro error;
  successful exports do not replace signed builds or device testing.
- Validate workflow changes on a branch: first run the normal workflow, then
  temporarily add a failing TypeScript assertion to an application test, commit
  and push, and confirm `Application checks` and the workflow fail. Remove the
  temporary test, push, and require a fresh passing run. Keep run links as evidence.

KC3-24 local verification (2026-09-08): a clean database reset applied all three
migrations and the unchanged seed. All 148 pgTAP assertions, database lint, three
live anonymous RPC tests, 44 application tests, typecheck, lint, formatting, and
`git diff --check` passed. Web, iOS, and Android production exports also passed.
The generated client database type remained unchanged because the public RPC
contract did not change. No Google request was made.

KC3-22 hosted verification (2026-09-06): the
[baseline run](https://github.com/jedipeter12/KC3/actions/runs/34067248542)
passed both jobs, including all three Expo exports, 30 application tests, 120
pgTAP assertions, database lint, and three live RPC smoke tests. The
[intentional-failure run](https://github.com/jedipeter12/KC3/actions/runs/34067834303)
failed with a temporary application test expecting `true` to equal `false`.
The probe was removed after verification. A fresh final branch run must pass
before review; no branch-protection settings were changed.

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
- Client database types: Keep the client-visible `Database` type limited to the
  approved RPC contract. Regenerate or update it whenever an approved migration
  changes that contract.
- Privileged credentials: Never place a Supabase secret/service-role key or direct
  database credential in an Expo, Expo Web, or other client bundle.

## Deployment / Release Process

No deployment or release process exists yet. Document exact, verified steps after
hosting and release tooling are selected.

## Troubleshooting

No application-specific troubleshooting guidance exists yet.
