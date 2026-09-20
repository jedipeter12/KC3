# Test Coverage and Reliability Review

**Review date:** 2026-08-23; updated 2026-09-20 for repeat refresh/integration
verification and the real provider-backed dataset, 2026-09-19 for Google
hours/source persistence, and previously updated 2026-09-08 for the Google
ingestion contract and 2026-09-06 for the client and public-read boundary

**Scope:** Approved behavior and current implementation in the KC3 repository.

## Scope and Established Behavior

KC3 currently contains an approved Supabase/PostgreSQL data model, local seed,
anonymous read-only place RPC, an Expo TypeScript client with a typed public data
layer and locally filtered place-list screen, and an operator-run Google Places
ingestion CLI. KC3-24 defines the Google normalization and ownership contract,
KC3-25 implements its bounded server-only workflow, KC3-26 verifies weekly hours
and provider-freshness persistence, and KC3-27 adds atomic reviewed seed
attachment and constructs the first real local dataset. This review covers those
boundaries, database behavior, the public data contract, the first screen's
component states, and the offline tests surrounding the attended live workflow.

## Existing Coverage Assessment

Before this review, the repository had empty placeholder `src/` and `tests/`
directories, no automated tests, no test command, and no selected test strategy.
The Supabase CLI was the only development dependency. The approved schema's
constraints, defaults, relationships, timestamp triggers, and RLS posture had no
executable regression protection.

There is no meaningful line-coverage percentage to report for a SQL migration.
The workspace suite provides 190 behavior and contract assertions across nine
pgTAP files. The first four files provide 87 schema assertions, including three
for privilege revocations. The seed-data test adds 12 assertions, the public
place access test adds 24 authorization/response-contract assertions, the Google
ingestion contract adds 25 assertions, the import-boundary suite adds 34, and the
reconciliation suite adds 8.

## Major Untested Risks Found

- The migration had not been proven from a clean database by an automated suite.
- Required canonical fields, unique Google Place IDs, explicit unknown values,
  nullable unknown booleans, and hours consistency checks had no negative tests.
- Shared primary-key ownership and cascading deletes had no executable coverage.
- Multiple intervals per weekday and overnight intervals had no regression tests.
- The four `updated_at` triggers and initial closed-by-default RLS configuration
  had no regression tests.
- KC3-22 adds a CI job for migration reset, database tests, and database linting.
- HTTP integration was initially absent; KC3-20 now covers the production client
  and data layer against the local Data API. Full UI end-to-end coverage is open.

## Tests Added

### Schema contract

`001_schema_contract.test.sql` verifies the five approved tables, approved enum
values, established columns, primary keys, cascading foreign keys, Google Place
ID uniqueness, hours checks, and lookup indexes. It protects against accidental
field or classification removal, ownership changes, loss of constraints, and
index regressions during later migrations.

### Canonical, Google, and KC3 detail records

`002_place_records.test.sql` verifies required canonical fields, active status
and timestamp defaults, unique-but-optional Google Place IDs, generated UUIDs,
explicit `unknown` detail defaults, nullable unknown booleans, separate Google
JSON/rating storage, one-to-one ownership, orphan rejection, and cascading
delete. It protects the approved ownership boundaries and prevents unknown values
from silently becoming false or null where the model uses an explicit value.

### Weekly hours

`003_place_hours.test.sql` exercises weekday boundaries, required fields, every
branch of the open/closed time check, default flags, closed-day null times, split
operating periods, overnight closing metadata, and orphan rejection. It protects
against schedule corruption, off-by-one weekday errors, and loss of split or
overnight-hours support.

### Timestamps and security posture

`004_timestamps_and_security.test.sql` verifies all five automatic `updated_at`
triggers, RLS enablement on all approved tables, the bounded policy count, and
trigger enablement. It protects freshness metadata and prevents unreviewed policy
growth.

Concurrent security work added tests proving current privileges and default
privileges for `postgres`-owned project tables, sequences, and functions remain
revoked from Supabase Data API roles.

### Local MVP seed

`005_seed_data.test.sql` verifies all 15 stable seed identities and canonical
values, even distribution across Lenexa, Overland Park, and Olathe, coverage of
the initial place types, active defaults, unknown/unverified KC3 detail shells,
and the absence of guessed Google data or weekly hours. Repeat execution of the
actual seed is also verified during seed-workflow changes because pgTAP receives
the post-seed database rather than executing the seed file itself.
The identity/provider and hours assertions are scoped so the same test remains
valid after reviewed provider enrichment and rejects partial source state.

### Anonymous public place access

`006_public_place_access.test.sql` verifies the hardened dedicated reader role,
the active-only RLS policy, the RPC owner and fixed search path, the five-field
response contract, and exact role and column grants. It executes the RPC as
`anon`, proves every non-active status is excluded, and verifies anonymous and
internal-reader writes fail. It also proves base tables and unapproved columns
remain inaccessible and that unapproved Data API roles cannot execute the RPC.

### Google ingestion contract

`007_google_ingestion_contract.test.sql` protects canonical/provider coordinate
pairs and ranges, provider metadata validation, move relationships, KC3-detail
preservation, source-specific hours replacement, effective-dated override
constraints and local-time resolution, and denial of override access to Data API
roles. `tests/google-contract.test.ts` protects the exact Google field mask,
deterministic cosmetic/substantive comparisons, movement screening, missing and
temporary-closure hour preservation, closed/split/overnight/24-hour schedules,
and malformed/overlapping schedule rejection.

### Google import boundary and hours/source persistence

`008_google_import_boundary.test.sql` exercises the constrained importer role,
server-only function grants, normalized allowlist, initial provider and schedule
creation, unchanged refreshes, changed wholesale Google-hours replacement,
missing-hours preservation, KC3-owned detail/hour preservation, source/fetch
timestamps, and transactional rollback. Planner fixtures additionally prove
that an unchanged or omitted schedule is excluded from the write payload while a
changed schedule is sent as a complete normalized replacement.
`009_google_reconciliation.test.sql` proves that the reviewed server-only wrapper
atomically attaches a provider identity to a stable seed UUID, persists provider
metadata, preserves unknown KC3 details, denies anonymous execution, and rolls
the identity attachment back when normalized provider persistence fails.
KC3-28 adds explicit repeat provider-row counting and re-checks the complete KC3
detail snapshot after changed, missing, and failed refreshes. Its live rerun also
found that JSON serialization was sensitive to PostgreSQL JSONB object-key order;
a regression fixture now proves structurally equal schedules are not replaced.

### Typed public-place client and place-list screen

Application tests verify the exact five-field TypeScript RPC contract, public
configuration validation, ordered and projected data-layer results, explicit
empty results, malformed responses, and sanitized provider failures. React
Native Testing Library component tests cover loading, ordered rows and their four
visible fields, derived city/place-type choices, combined name/city/type
interactions, clearing without another request, distinct database-empty and
no-match states, sanitized error presentation, and retry recovery. Pure utility
tests cover trimmed case-insensitive name matching, whitespace-only queries, AND
semantics, option derivation, and loaded-order preservation.

KC3-19 strengthens component coverage with overlapping name/city/type fixtures:
each constraint removes a different record, and resetting city or type retains
the remaining constraints. It verifies a successful trimmed mixed-case query,
whitespace-only search, selected filter semantics, and a single data request
throughout these interactions. An expanded runtime fixture proves IDs, Google
metadata, status, hours, and curation notes are not displayed. Database-empty
results also explicitly omit search controls and the no-match message.

All KC3-19 acceptance states are covered through focused assertions, without
snapshots. These are component and unit checks, not live backend or device tests.

## Deliberately Not Tested

- Later detail/map presentation: no such feature implementation exists yet.
- Future authenticated and administrative CRUD flows: these role behaviors are
  not approved. KC3-20 covers the current anonymous RPC over HTTP; full Expo UI
  end-to-end coverage remains open.
- Live Google network calls and credentials: provider and importer behavior is
  covered with fixtures, mocked HTTP, and the real local database boundary;
  normal tests and CI intentionally make no billable provider request.
- Blank canonical text remains undecided outside the trusted importer, which
  rejects it for new provider-backed places.
- Automated accessibility, performance/load, and end-to-end behavior: component
  tests cover the first screen's primary semantics and a manual Web viewport
  check has been completed, but broader tooling remains undecided.
- Automated mobile device interaction: manual iOS Simulator functional smoke
  passes against the real local dataset, but UI automation is blocked; Android
  tooling was unavailable during KC3-21. Bundle exports do not establish device
  behavior. See `ACCESSIBILITY_REVIEW.md`.

## Product Owner Decisions Required

**PRODUCT OWNER DECISION REQUIRED — Blank canonical text**

The approved documents say name, city, and address are required but do not state
whether empty or whitespace-only values are invalid. Decide and document whether
blank values must be rejected before adding a constraint and tests.

**PRODUCT OWNER DECISION REQUIRED — Administrative and future authenticated roles**

Anonymous active-place reads are approved and covered. `authenticated` and
`service_role` retain no access to that RPC or the base tables, and import/
administrative workflows remain undecided. Define any additional role behavior
before grants and role-level tests lock it in. See `SECURITY_REVIEW.md` for the
broader risk analysis.

Canonical duplicate handling, Google rating bounds, provider regular-hours
normalization, and freshness semantics are accepted in
[`GOOGLE_INGESTION_CONTRACT.md`](GOOGLE_INGESTION_CONTRACT.md). Database, pure
contract, and importer tests protect the enforceable portions; explicit duplicate
selection and moved-listing resolution remain deferred operator workflows. The
manual CLI now supports a noninteractive explicit attachment to a known KC3 UUID
and an explicit create resolution for a reviewed false positive; neither performs
automatic or fuzzy merging.

## Remaining Gaps and Prioritized Next Work

1. **Maintain database verification in CI (KC3-22).** The workflow runs a clean local
   Supabase start/reset, `npm test`, and `npm run lint:db` for pull requests. This
   prevents later migrations from breaking schema creation, constraints,
   triggers, indexes, or security posture.
2. **Resolve the Product Owner decisions above.** Then add focused positive and
   negative tests for each approved rule. This avoids codifying assumptions while
   closing real data-quality and authorization risks.
3. **Keep the KC3-20 HTTP/client integration smoke test current.** Run
   `npm run test:integration` against either the reset local seed or the reviewed
   provider-backed local dataset; it verifies the typed production client, raw
   five-field serialization and approved city/type values, data-layer results,
   production search and city/type filters, and explicit anonymous base-table
   permission denial. `KC3_EXPECT_PROVIDER_DATASET=1` also requires production-
   like volume and all six types. No provider mocks or additional dependencies
   are used.
   KC3-22 includes the clean-reset form of this suite in CI.
4. **Keep importer regression coverage current.** The existing suite covers
   source ownership, stable-identity idempotency, regular-hours refresh behavior,
   atomic seed attachment, and transaction failure. Add matching coverage when
   moved-listing resolution or any new retained provider field is approved.
5. **Continue expanding the Jest baseline with feature behavior.** Add focused
   unit and interaction tests for approved validation, transformations, and
   multi-branch utilities as they appear. This prevents client behavior from
   drifting from the database and approved rules.
6. **Expand API/client integration coverage with richer approved fields.** Verify
   enum, nullable boolean, date, time, JSON, and error serialization as those
   values enter the public contract. This prevents type-generation and
   transformation bugs that database-only tests cannot observe.
7. **Add end-to-end and accessibility coverage after those experiences are
   approved.** Focus on critical discovery flows, not implementation-detail
   snapshots. This prevents broken user journeys without prematurely defining the
   MVP.

## Verification Results

**KC3-28 locally verified: 2026-09-20**

- The clean bounded live write recorded 263 discoveries, 149 inserts, 15 seed
  updates, 99 skips, and zero failures. The immediate repeat inserted zero and
  left 164 canonical rows, 164 provider rows, and 1,118 Google-hour rows.
- The repeat exposed and corrected JSONB object-key-order sensitivity in
  unchanged schedule comparison. A post-fix live rerun advanced provider fetch
  times while 158 refreshed stored schedules retained older source observation
  times; one unrefreshed ranked omission retained its prior equal timestamps.
- A controlled verified KC3 detail fixture survived all provider refreshes
  exactly and was removed after evidence capture. Deterministic fixtures cover
  changed, missing, closed, malformed, interrupted, and rollback behavior.
- All 190 pgTAP assertions, 66 application tests, four real-dataset anonymous
  HTTP tests, database lint, typecheck, lint, formatting, three-platform exports,
  and Expo Web functional smoke passed. Native UI automation remained blocked by
  Device Hub timeout after the iOS bundle launched.

**KC3-27 verified: 2026-09-20**

- All 188 pgTAP assertions and database lint passed against both a clean reset
  and the 162-place imported local dataset.
- All 60 application/importer tests, typecheck, lint, formatting, and all three
  Expo exports passed; the server-only key value was absent from generated files.
- All three live anonymous RPC tests passed against the real dataset, and direct
  anonymous table access remained denied.
- Live Expo Web loaded the real dataset and passed name plus combined city/type
  filtering through the unchanged five-field RPC boundary.
- The committed audit found no exact canonical duplicate, invalid city/type,
  missing source/fetch metadata, malformed stored hours, or fabricated KC3
  suitability value. Coverage caps and the one unreconciled seed are recorded in
  `KC3_27_DATASET.md`.

**KC3-26 verified: 2026-09-19**

- All 180 pgTAP assertions cover the existing schema and the expanded real
  import-boundary refresh scenarios.
- All 57 application tests include changed, unchanged, and omitted weekly-hours
  planning without a Google request.
- The public response/type contract remains exactly five fields; no schema,
  client API, or field-mask expansion was required.

**KC3-24 verified: 2026-09-08**

- Clean local reset applied all migrations and the unchanged seed.
- All 148 pgTAP assertions and database lint passed.
- All 44 application tests, including 14 pure Google contract cases, passed with
  typecheck, lint, formatting, `git diff --check`, and all three platform exports.
- All three live anonymous RPC tests passed; the public response/type contract
  remained exactly five fields.
- No Google request, importer, privileged role, or client API expansion was
  introduced.

**KC3-23 partial verification: 2026-09-06**

All 30 application tests, 120 pgTAP assertions, three live RPC tests, application
quality checks, database reset/lint, and three-platform exports passed on the
pinned runtime. Live Expo Web loaded the 15 seeded places and passed combined
search/filter, no-match, and clearing checks. Native interaction remains blocked
by simulator automation failure. See [the milestone report](MVP_VERIFICATION.md)
for acceptance evidence and the remaining closeout gate.

**KC3-20 verified: 2026-09-06**

- Clean local Supabase start/reset: passed with both migrations and the MVP seed.
- `npm run test:integration`: all three live tests passed using Node 24.20.0 and
  npm 11.19.0. Raw RPC results contain all 15 seed IDs and exactly five fields;
  the production data layer returns the same records; direct anonymous table
  reads fail with HTTP 401 / `42501`.
- An unavailable CLI/Docker-access run failed with prerequisite instructions and
  without exposing captured CLI output.
- `npm test`: all 120 pgTAP assertions passed; `npm run lint:db`: no schema errors.
- All 30 application tests, typecheck, lint, formatting, and Web/iOS/Android
  production exports passed on the pinned Node/npm runtime. Exports used
  placeholder public configuration; live integration used local anonymous config.
- No production application code, migrations, seed, or dependencies changed.

**KC3-21 partial verification: 2026-09-06**

All 30 application tests, typecheck, lint, formatting, and three-platform exports
passed after accessibility fixes. Manual Web checks and the native launch result
are recorded in [`ACCESSIBILITY_REVIEW.md`](ACCESSIBILITY_REVIEW.md). Native
interactions, large text, and spoken screen-reader checks remain incomplete.

**KC3-19 reverified: 2026-09-06**

- `npm run test:app`: 28 tests passed across six suites, with no snapshots.
- `npm run typecheck`, `npm run lint`, and `npm run format:check`: passed.
- `npm run export`: Web, iOS, and Android production bundles passed using
  placeholder public configuration; this does not verify a live backend.
- Database behavior is unchanged; the database results below are from the prior
  verification, not a new database run for this test-only ticket.

**Reverified:** 2026-09-05

- Assertion-plan consistency: passed; the six files declare and contain
  21 + 32 + 21 + 10 + 12 + 24 = 120 assertions.
- Package lock refresh: passed with `npm install --package-lock-only
  --ignore-scripts`.
- Whitespace/error check: passed with `git diff --check`.
- Supabase startup and clean database reset: passed; the migration and seed
  applied from a fresh local database.
- Seed rerun: passed; a second execution inserted no duplicate places or detail
  rows and preserved simulated canonical, KC3, Google, and hours edits.
- Seed transaction failure: passed; a deliberately injected failure rolled back
  rows inserted earlier in the transaction.
- Database tests: passed with `npm test`; all 120 assertions succeeded across six
  pgTAP files.
- Local PostgREST smoke test: passed; the anonymous RPC returned all 15 seed rows
  with exactly the five approved fields, while direct `places` access returned
  HTTP 401.
- Database lint: passed with `npm run lint:db`; no schema errors were found.
- Typecheck: passed with `npm run typecheck`.
- Application lint: passed with `npm run lint`.
- Formatting: passed with `npm run format:check`.
- Application tests: passed with `npm run test:app`; 26 tests succeeded across
  six suites.
- Export: passed with `npm run export`; Expo produced Web, iOS, and Android
  bundles.
- Expo Web development server: started successfully and returned HTTP 200.
- Responsive interaction check: passed at 1280×800 and 390×844 with local place
  fixtures; combined filters, no-match behavior, clearing, and a clean browser
  console were verified.
