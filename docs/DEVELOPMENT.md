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

### Local iOS simulator accessibility automation

The KC3-31 practical iOS pass used Meta idb when direct Device Hub attachment
was unavailable. Install the companion and CLI through the maintained Homebrew
tap, boot an iOS simulator, and confirm its identifier:

```sh
brew install facebook/fb/idb
idb list-targets
```

Pass the booted simulator's UDID to `idb ui describe-all`, `idb ui tap`,
`idb ui set-value`, `idb ui scroll`, and `idb ui swipe`. Use
`xcrun simctl ui booted content_size` to inspect or change Dynamic Type and
restore the user's original setting after the check. idb accessibility-tree
inspection and direct actions are useful for practical checks, but they do not
replace a user-attended VoiceOver pass with actual spoken output and VoiceOver
gestures.

### Local Android emulator setup

The KC3-31 native pass used the following Apple-silicon Homebrew toolchain:

```sh
brew install openjdk@21
brew install --cask android-commandlinetools
```

Configure the installed JDK and SDK for the shell running Android tools:

```sh
export JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
export ANDROID_HOME="/opt/homebrew/share/android-commandlinetools"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
```

Install Platform Tools, the emulator, API 36, and the Google APIs ARM64 image
with `sdkmanager`, accept the standard Android SDK component licenses, and create
an AVD with `avdmanager`. The verified AVD used a Pixel 9 profile and
`system-images;android-36;google_apis;arm64-v8a`.

When Expo and local Supabase run on the Mac, reverse the selected Expo port and
the local Supabase API port into the booted emulator. Reapply these tunnels after
an emulator restart when needed:

```sh
adb reverse tcp:8085 tcp:8085
adb reverse tcp:54321 tcp:54321
```

Replace `8085` with the actual Expo port. The Supabase tunnel is required for the
app's `127.0.0.1:54321` public API URL; without it, the app intentionally reaches
the sanitized retry state.

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
effective-dated overrides, and local-time override resolution. KC3-30 coverage
also verifies address precision, drive-thru combinations, exact expanded RPC
shapes, effective-hours priority, open/closed transitions, 24-hour schedules,
14-day hours freshness, 180-day KC3 freshness, and expanded least-privilege
authorization.

Run PostgreSQL lint checks against the same local database with
`npm run lint:db`. The command targets KC3's `public` schema and fails on project
warnings; it excludes third-party extension internals installed by the test suite.

### Application Unit Tests

Run `npm run test:app` for the Jest application suite. Jest uses the `jest-expo`
preset and application tests live in `tests/`. The suite protects the shared
application identity and Supabase configuration, the exact public database type,
and the public-place data layer's ordered success, empty, malformed-response,
and sanitized provider-error behavior.

The current screen calls `listPublicPlaceSummaries()` and detail navigation calls
`getPublicPlaceDetail()`. The legacy `listPublicPlaces()` operation remains typed
and covered for compatibility. Successful empty list responses return `[]`, and
an unavailable detail
ID returns null. Null, malformed, impossible drive-thru combinations, invalid
nested schedules, provider errors, and rejected requests throw the stable
`PUBLIC_PLACES_UNAVAILABLE` application error without including underlying
details.

React Native Testing Library component tests exercise summary cards, the default
drive-thru-only exclusion, draft/apply filters, approved positive-filter
semantics, list/detail navigation and state preservation, cached identity during
detail failures, retry, announcements, and distinct empty/no-match/error states.
Pure unit tests protect name-query normalization, AND semantics, exact unknown
and positive matching, derived choices, and order preservation. Screen
dependencies are injected only at the component boundary for focused testing;
production uses the approved public-place data operations.

`tests/google-contract.test.ts` protects the shared importer contract without
calling Google: the exact field mask, deterministic cosmetic comparison,
100-meter material-location screening, missing-hours preservation, explicit
closed schedules, split and overnight intervals, 24/7 normalization, and invalid
schedule rejection. The authoritative workflow contract is
[`GOOGLE_INGESTION_CONTRACT.md`](GOOGLE_INGESTION_CONTRACT.md).

`tests/google-place-ingestion.test.ts` uses provider fixtures and mocked HTTP and
database boundaries. It verifies Place Details transformation, Text Search
continuation, exact masks, duplicate/change planning, missing server
configuration, malformed records, and sanitized provider/database failures
without a Google credential or billable request. The pgTAP importer suite
exercises actual insert/repeat transactions, provider refreshes, KC3 field and
hours preservation, permissions, and rollback against local Supabase.

The hand-maintained client database type exposes only the three approved public
place RPCs. Base tables and internal ingestion, hours-resolution, and override
helpers are not client APIs.

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

The suite supports both the clean 15-place seed and a reviewed provider-backed
local dataset. It checks every legacy row's exact raw five-field shape and
approved city/type bounds, verifies the exact expanded summary/detail shapes,
compares all three production data-layer operations, confirms unknown detail IDs
remain hidden, exercises production name/city/place-type filters against the
live response, and requires HTTP 401 / PostgreSQL `42501` for direct `places`
reads. Missing
migrations, an empty dataset, or API failures fail the suite; they are not
silently skipped. Run `npm test` and `npm run lint:db` against a clean reset and
again after importing. Database fixtures and seed assertions are scoped so the
same suite supports provider-enriched local state. `test:app` remains independent
of Docker and excludes the `*.smoke.ts` integration files.

Set `KC3_EXPECT_PROVIDER_DATASET=1` for the post-import run. This additionally
requires more than 100 public rows and all six approved place types, preventing a
clean seed from being mistaken for the real-dataset smoke:

```sh
KC3_EXPECT_PROVIDER_DATASET=1 npm run test:integration
```

See [`ACCESSIBILITY_REVIEW.md`](ACCESSIBILITY_REVIEW.md) for the KC3-21 manual
viewport/keyboard results, accessibility fixes, and outstanding native,
large-text, and spoken screen-reader checks. Use `npm run test:app` for the
focused Web pressed-state and iOS announcement regression tests.

The approved Supabase RPC authorization behavior is tested at the PostgreSQL role
level with pgTAP and over the local Data API with the Jest smoke suite. Component
tests use React Native Testing Library. No end-to-end framework has been selected.

## Manual Google Places Ingestion

The KC3-25 importer is an operator-run command, not an application feature or
scheduled job. It uses billable Google Places API (New) Text Search and Place
Details calls. Confirm the Google project has billing and Places API (New)
enabled, restrict the key to that API where practical, and prepare the target
Supabase database with all migrations before running it.

Set these values in the ignored `.env.local` file or in the operator process
environment:

- `GOOGLE_PLACES_API_KEY`: server/operator Google Places key.
- `KC3_SUPABASE_URL`: target Supabase API URL.
- `KC3_SUPABASE_SERVICE_ROLE_KEY`: target server-side service-role key.

These names intentionally do not use `EXPO_PUBLIC_`. Never copy their values into
app configuration, command examples, logs, screenshots, issues, or commits. The
CLI identifies missing variable names but never prints configured values,
provider response bodies, or database error details.

Every run requires explicit city and KC3 category allowlists. Supported cities
are Lenexa, Overland Park, and Olathe. Supported categories are `coffee_shop`,
`cafe`, `boba_tea`, `library`, `coworking`, and `park`. Start with a small dry
run:

```sh
npm run ingest:google -- --city Lenexa --category coffee_shop --max-pages 1 --max-places 20
```

Use comma-separated quoted values for multiple bounds. The command defaults to
at most three 20-result pages per city/category and 60 unique places globally;
`--max-pages` accepts 1–3 and `--max-places` accepts 1–200. It requests only IDs
and continuation from Text Search, applies a strict supported Google type for
each KC3 category, deduplicates IDs, then uses the exact KC3-24 Place Details
field mask. `boba_tea` uses Google's `tea_house` discovery type. Results whose
resolved city is outside the requested city, malformed records, movement
candidates, moved listings, and unresolved canonical duplicates are skipped and
reported. Every requested city/category query is attempted even if the global
unique-place selection bound has already been reached. The query summary records
pages fetched, a remaining provider continuation (`provider capped=yes`), and
IDs omitted by the global bound (`selection capped=yes`); either cap means the
run is bounded evidence, not exhaustive coverage.

KC3-27 adds two explicit review resolutions. Repeat `--attach
<GoogleID=KC3UUID>` to bind a provider result to an existing canonical place, or
repeat `--create <GoogleID>` only after confirming that a deterministic duplicate
candidate is a different physical place. Attachments preserve the existing KC3
UUID, classification, and details. The provider identity and normalized provider
data commit in one transaction; any rejected payload rolls both back. Neither
option performs a fuzzy or automatic merge.

Review dry-run counts and notices, then repeat the identical bounds with
`--write` to commit one transaction per valid place:

```sh
npm run ingest:google -- --city Lenexa --category coffee_shop --max-pages 1 --max-places 20 --write
```

Output identifies the mode and aggregate `Discovered`, `Inserted`/`Would
insert`, `Updated`/`Would update`, `Skipped`, and `Failed` counts, followed by
sanitized record notices. Any failed provider query, detail call, database-state
read, or database write contributes to `Failed`; a run with failures exits
nonzero. Skips are safe review outcomes and do not by themselves fail the run.
Re-running the write command matches by Google Place ID and refreshes the same
KC3 place. Missing provider fields are preserved, and the database function has
no ability to write `place_details`, `place_overrides`, or KC3-owned hours.

### Recreate or refresh the KC3 MVP dataset

Use a disposable local database unless a separately authorized target is named.
Do not reset a database that contains unexported KC3 curation.

1. Run `npm exec -- supabase db reset --local`, `npm test`, and `npm run
   lint:db`. This proves the clean seed and import boundary before provider data
   changes the local state.
2. Recreate the recorded KC3-27 bound with one page per category and a 200-place
   city cap. Run Lenexa's five non-park categories together, Lenexa park
   separately with `--max-pages 3` (the recorded search ended naturally after
   two), and all six categories together for each other city. This attempts all
   18 pairs without allowing one city's results to consume another city's cap.
3. Record every query's count and cap flags in
   [`KC3_27_DATASET.md`](KC3_27_DATASET.md). Review every planned insert against
   the 15 representative seed records. Add an `--attach` mapping when both refer
   to the same physical place; use `--create` only for a confirmed false-positive
   duplicate. A representative seed left without an identity must be investigated
   or documented as a coverage gap.
4. Repeat the same dry-run with all resolutions. It must show the reviewed seed
   places as updates, not inserts. Then repeat the identical command with
   `--write`. Keep the query bounds and resolutions unchanged between those two
   runs.
5. Run the read-only queries in
   [`supabase/audits/kc3_27_dataset.sql`](../supabase/audits/kc3_27_dataset.sql).
   Record aggregate counts and resolve or document every nonempty issue result.
   Spot-check at least one stored canonical/provider/hours record from each city.
6. Run `npm test`, `npm run lint:db`, and `npm run test:integration` against the
   imported state. Then launch `npm run web` with the local public URL/key and
   confirm the list loads through `list_public_places()`. Do not add a direct-table
   client path. Record Web and, when available, mobile smoke results.

The complete pair matrix is the Cartesian product of:

- Cities: Lenexa, Overland Park, Olathe.
- Categories: `coffee_shop`, `cafe`, `boba_tea`, `library`, `coworking`, `park`.

For example, the recorded Lenexa coffee/cafe/boba/library/coworking bound and one
of its reviewed attachments are:

```sh
npm run ingest:google -- --city Lenexa --category coffee_shop,cafe,boba_tea,library,coworking --max-pages 1 --max-places 200
npm run ingest:google -- --city Lenexa --category coffee_shop,cafe,boba_tea,library,coworking --max-pages 1 --max-places 200 --attach 'ChIJW4FqNKmUwIcRDtDZHMN3rV8=6b633300-0000-4000-8000-000000000002' --write
```

Pass every applicable reviewed mapping from `KC3_27_DATASET.md` and the current
`KC3_28_VERIFICATION.md` record to its command. Never reuse a mapping without
reviewing that live result. Current run evidence and known coverage limitations
belong in the corresponding run record, not only in terminal history.

Normal tests and CI never invoke Google. An operator may use the small dry run
above and its matching `--write` command as an explicitly billable live smoke
check after reviewing the target and bounds; this is not a CI or release gate.

### Verify an immediate refresh

KC3-28 adds the repeatability check after dataset construction:

1. Pre-populate a clearly labeled, disposable KC3 detail fixture on a reviewed
   seed place and save its exact values and `last_verified_at`.
2. Run the dry-run-first bounded write commands and record discovered, inserted,
   updated, skipped, and failed counts.
3. Run `supabase/audits/kc3_28_refresh.sql` from a trusted PostgreSQL session and
   save its aggregate row. All issue queries must be empty.
4. Immediately repeat the identical bounded write commands. Search ranking may
   change the discovered set, but already seen Google IDs must update stable
   KC3 identities and must not create duplicate canonical, provider, or hour
   rows.
5. Run the audit again. Canonical/provider/hour counts must remain stable absent
   genuinely new ranked identities. `google_fetched_at` advances for successful
   responses; unchanged or omitted schedules retain their earlier
   `source_observed_at`; KC3 detail verification values remain exact.
6. Run `npm test`, `npm run lint:db`, and
   `KC3_EXPECT_PROVIDER_DATASET=1 npm run test:integration`, then complete Web and
   practical native smoke checks. Remove only the controlled fixture after its
   preservation is recorded.

For the local project, the read-only audit can be piped into the database
container without copying credentials:

```sh
docker exec -i supabase_db_KC3 psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < supabase/audits/kc3_28_refresh.sql
```

The completed evidence, discovered provider variability, and known limitations
are recorded in [`KC3_28_VERIFICATION.md`](KC3_28_VERIFICATION.md).

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

The Google importer additionally uses the three server-only variables documented
in “Manual Google Places Ingestion.” They are read only by the CLI entry point;
they are not referenced by the Expo client or its public Supabase configuration.

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

KC3-30 local verification (2026-09-22): a clean reset applied the expanded
anonymous public-place migration and unchanged seed. All 225 pgTAP assertions,
database lint, six live anonymous integration tests, 73 application tests,
typecheck, ESLint, formatting, `git diff --check`, and Web/iOS/Android production
exports passed. The legacy five-field consumer remained compatible. No Google
request or privileged client credential was used. A hosted branch run remains
required before review is merged. A rolled-back 164-place probe with 1,043
schedule rows completed in 35.9 ms after write-boundary timezone validation
replaced per-place catalog scans; the pre-fix empty-schedule probe took 4.53
seconds.

KC3-28 local verification (2026-09-20): a clean bounded live import inserted 149,
updated 15, skipped 99, and failed zero records. The immediate repeat inserted
zero and exposed/fixed object-key-order sensitivity in unchanged-hours equality.
The final 164-place/164-provider/1,118-hour snapshot passed 190 pgTAP assertions,
database lint, four real-dataset anonymous integration tests, 66 application
tests, typecheck, lint, formatting, `git diff --check`, all platform exports, and
Expo Web search/filter smoke. The iOS simulator bundled and launched, but Device
Hub UI automation timed out, so native interaction was not claimed as passed.

KC3-26 local verification (2026-09-19): the existing schema and importer passed
all 180 pgTAP assertions, database lint, three live anonymous RPC tests, 57
application tests, typecheck, lint, formatting, and `git diff --check`. Web, iOS,
and Android production exports passed. The public five-field client contract and
Google field mask remained unchanged, and no Google request was made.

KC3-25 local verification (2026-09-08): a clean database reset applied the
server-only import-boundary migration and unchanged seed. All 168 pgTAP
assertions, database lint, three live anonymous RPC tests, 55 application tests,
typecheck, lint, formatting, and `git diff --check` passed. A direct local
production repository smoke read returned the validated 15-place planning
projection through the local service-role boundary. Web, iOS, and
Android production exports passed, and an export scan found no Google API URL or
server-only ingestion variable names. No Google request was made.

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
