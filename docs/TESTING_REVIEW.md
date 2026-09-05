# Test Coverage and Reliability Review

**Review date:** 2026-08-23

**Scope:** Approved behavior and current implementation in the KC3 repository.

## Scope and Established Behavior

KC3 currently contains an approved Supabase/PostgreSQL data model and no client
application, API/server implementation, TypeScript application logic, utilities,
search/filter implementation, or automated import workflow. This review covers
the migration in `supabase/migrations/` and the approved local seed without
defining behavior for candidate client features that `PRODUCT.md` marks as
unapproved.

## Existing Coverage Assessment

Before this review, the repository had empty placeholder `src/` and `tests/`
directories, no automated tests, no test command, and no selected test strategy.
The Supabase CLI was the only development dependency. The approved schema's
constraints, defaults, relationships, timestamp triggers, and RLS posture had no
executable regression protection.

There is no meaningful line-coverage percentage to report for a SQL migration.
The workspace suite provides 96 behavior and contract assertions across five
pgTAP files. The first four files provide 84 schema assertions, including three
for privilege revocations. The seed-data test adds 12 assertions.

## Major Untested Risks Found

- The migration had not been proven from a clean database by an automated suite.
- Required canonical fields, unique Google Place IDs, explicit unknown values,
  nullable unknown booleans, and hours consistency checks had no negative tests.
- Shared primary-key ownership and cascading deletes had no executable coverage.
- Multiple intervals per weekday and overnight intervals had no regression tests.
- The four `updated_at` triggers and closed-by-default RLS configuration had no
  regression tests.
- No CI job runs migration reset, database tests, or database linting.
- No API or client exists through which to test role-based access,
  transformations, search/filter behavior, or end-to-end behavior.

## Tests Added

### Schema contract

`001_schema_contract.test.sql` verifies the four approved tables, approved enum
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

`004_timestamps_and_security.test.sql` verifies all four automatic `updated_at`
triggers, RLS enablement on all approved tables, absence of policies, and trigger
enablement. It protects freshness metadata and the accepted closed-by-default
access decision while roles and policies remain undefined.

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

## Deliberately Not Tested

- Search/filter behavior, list/detail/map presentation, and client logic: these
  are candidate features, not approved behavior, and no implementation exists.
- API response behavior and role-level CRUD flows: no API policy or role behavior
  is approved, and no client/API implementation exists.
- Google ingestion, freshness calculations, and general import normalization: no
  workflows or rules are approved or implemented.
- Place deduplication, hours overlap/equal-time rules, and consistency between the
  next-day flag and actual clock ordering: approved documents do not define them.
- Blank-text, Google rating bounds, and closed/next-day semantics remain untested
  because they are not clearly approved behavior.
- UI, accessibility, performance/load, and end-to-end behavior: no client exists
  and the corresponding requirements and tooling are undecided.
- TypeScript typechecking, application linting, and application builds: no
  TypeScript/application sources or configurations exist.

## Product Owner Decisions Required

**PRODUCT OWNER DECISION REQUIRED — Blank canonical text**

The approved documents say name, city, and address are required but do not state
whether empty or whitespace-only values are invalid. Decide and document whether
blank values must be rejected before adding a constraint and tests.

**PRODUCT OWNER DECISION REQUIRED — Google rating validation**

The approved documents say Google rating attributes are stored but do not define
their ranges. Decide whether ratings must be 0 through 5 and counts nonnegative
before adding constraints and tests.

**PRODUCT OWNER DECISION REQUIRED — Additional hours consistency**

The approved documentation does not say whether a closed row may also be marked
as closing the next day. It also does not decide whether duplicate/overlapping
intervals, equal open/close times, or a next-day flag with a later closing time
should be rejected. Confirm the semantics before adding constraints or tests.

**PRODUCT OWNER DECISION REQUIRED — Data API and administrative roles**

The accepted design enables RLS with no policies, and the current working-tree
migration also revokes privileges from `anon`, `authenticated`, and
`service_role`. Roles and import/administrative workflows remain undecided.
Define which roles need read/write access before role-level tests lock in
privilege behavior. See `SECURITY_REVIEW.md` for the broader risk analysis.

**PRODUCT OWNER DECISION REQUIRED — Canonical deduplication**

Only a non-null Google Place ID is unique. Two otherwise identical places with no
Google Place ID are allowed. Decide whether that is intentional or whether a
curation/import workflow, rather than a database constraint, will own duplicate
detection.

## Remaining Gaps and Prioritized Next Work

1. **Add database verification to CI once CI is selected.** Run a clean local
   Supabase start/reset, `npm test`, and `npm run lint:db` for pull requests. This
   prevents later migrations from breaking schema creation, constraints,
   triggers, indexes, or security posture.
2. **Resolve the Product Owner decisions above.** Then add focused positive and
   negative tests for each approved rule. This avoids codifying assumptions while
   closing real data-quality and authorization risks.
3. **Add role-level RLS/API tests with the first approved policies.** Exercise
   SELECT, INSERT, UPDATE, and DELETE as each approved role, including negative
   cases. This prevents data exposure, unauthorized writes, and incomplete
   policies.
4. **Test future import workflows when approved and implemented.** Cover source
   ownership, idempotency, duplicate handling, raw-data retention, and transaction
   failure. This prevents reruns from duplicating places or partially refreshing
   data.
5. **Select application test tooling during Expo scaffolding.** Add unit tests for
   approved validation, transformations, filters, and multi-branch utilities as
   they appear. This prevents client behavior from drifting from the database and
   approved rules.
6. **Add API/client integration tests with the first data-access layer.** Verify
   real enum, nullable boolean, date, time, JSON, and error serialization against
   local Supabase. This prevents type-generation and transformation bugs that
   database-only tests cannot observe.
7. **Add end-to-end and accessibility coverage after those experiences are
   approved.** Focus on critical discovery flows, not implementation-detail
   snapshots. This prevents broken user journeys without prematurely defining the
   MVP.

## Verification Results

**Reverified:** 2026-09-05

- Assertion-plan consistency: passed; the five files declare and contain
  21 + 32 + 21 + 10 + 12 = 96 assertions.
- Package lock refresh: passed with `npm install --package-lock-only
  --ignore-scripts`.
- Whitespace/error check: passed with `git diff --check`.
- Supabase startup and clean database reset: passed; the migration and seed
  applied from a fresh local database.
- Seed rerun: passed; a second execution inserted no duplicate places or detail
  rows and preserved simulated canonical, KC3, Google, and hours edits.
- Seed transaction failure: passed; a deliberately injected failure rolled back
  rows inserted earlier in the transaction.
- Database tests: passed with `npm test`; all 96 assertions succeeded across five
  pgTAP files.
- Database lint: passed with `npm run lint:db`; no schema errors were found.
- Typecheck: not applicable; no TypeScript source or TypeScript configuration.
- Application lint: not applicable; no application source or lint configuration.
- Build: not applicable; Expo is not scaffolded and no build command exists.
