# Test Coverage and Reliability Review

**Review date:** 2026-08-23; updated 2026-09-05 for public place access and the
Expo client scaffold

**Scope:** Approved behavior and current implementation in the KC3 repository.

## Scope and Established Behavior

KC3 currently contains an approved Supabase/PostgreSQL data model, local seed,
anonymous read-only place RPC, and an Expo TypeScript client scaffold. The client
does not yet contain a Supabase data layer, search/filter implementation, or
feature UI, and there is no custom server or automated import workflow. This
review covers the database behavior plus the scaffold's application quality
baseline without defining unapproved client behavior.

## Existing Coverage Assessment

Before this review, the repository had empty placeholder `src/` and `tests/`
directories, no automated tests, no test command, and no selected test strategy.
The Supabase CLI was the only development dependency. The approved schema's
constraints, defaults, relationships, timestamp triggers, and RLS posture had no
executable regression protection.

There is no meaningful line-coverage percentage to report for a SQL migration.
The workspace suite provides 120 behavior and contract assertions across six
pgTAP files. The first four files provide 84 schema assertions, including three
for privilege revocations. The seed-data test adds 12 assertions, and the public
place access test adds 24 authorization and response-contract assertions.

## Major Untested Risks Found

- The migration had not been proven from a clean database by an automated suite.
- Required canonical fields, unique Google Place IDs, explicit unknown values,
  nullable unknown booleans, and hours consistency checks had no negative tests.
- Shared primary-key ownership and cascading deletes had no executable coverage.
- Multiple intervals per weekday and overnight intervals had no regression tests.
- The four `updated_at` triggers and initial closed-by-default RLS configuration
  had no regression tests.
- No CI job runs migration reset, database tests, or database linting.
- No client data layer or HTTP integration test exists to verify RPC
  serialization, transformations, search/filter behavior, or end-to-end behavior.

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

### Anonymous public place access

`006_public_place_access.test.sql` verifies the hardened dedicated reader role,
the active-only RLS policy, the RPC owner and fixed search path, the five-field
response contract, and exact role and column grants. It executes the RPC as
`anon`, proves every non-active status is excluded, and verifies anonymous and
internal-reader writes fail. It also proves base tables and unapproved columns
remain inaccessible and that unapproved Data API roles cannot execute the RPC.

## Deliberately Not Tested

- Approved list/search/filter behavior and all later detail/map presentation: no
  feature implementation exists yet.
- Automated HTTP serialization and Expo client integration for the approved RPC,
  plus all future authenticated and administrative CRUD flows: no client data
  layer exists and those additional role behaviors are not approved.
- Google ingestion, freshness calculations, and general import normalization: no
  workflows or rules are approved or implemented.
- Place deduplication, hours overlap/equal-time rules, and consistency between the
  next-day flag and actual clock ordering: approved documents do not define them.
- Blank-text, Google rating bounds, and closed/next-day semantics remain untested
  because they are not clearly approved behavior.
- Feature UI, accessibility, performance/load, and end-to-end behavior: the
  scaffold has no discovery flow yet and the corresponding automated tooling is
  undecided.
- Automated mobile device launch behavior: the current environment verifies iOS
  and Android bundles, but has no configured simulator target.

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

**PRODUCT OWNER DECISION REQUIRED — Administrative and future authenticated roles**

Anonymous active-place reads are approved and covered. `authenticated` and
`service_role` retain no access to that RPC or the base tables, and import/
administrative workflows remain undecided. Define any additional role behavior
before grants and role-level tests lock it in. See `SECURITY_REVIEW.md` for the
broader risk analysis.

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
3. **Add HTTP/client integration tests with the first Expo data layer.** Verify
   the RPC response and error serialization through the generated Supabase client
   without granting base-table access.
4. **Test future import workflows when approved and implemented.** Cover source
   ownership, idempotency, duplicate handling, raw-data retention, and transaction
   failure. This prevents reruns from duplicating places or partially refreshing
   data.
5. **Expand the Jest baseline with feature behavior.** Add unit tests for approved
   validation, transformations, filters, and multi-branch utilities as they
   appear. This prevents client behavior from drifting from the database and
   approved rules.
6. **Expand API/client integration coverage with richer approved fields.** Verify
   enum, nullable boolean, date, time, JSON, and error serialization as those
   values enter the public contract. This prevents type-generation and
   transformation bugs that database-only tests cannot observe.
7. **Add end-to-end and accessibility coverage after those experiences are
   approved.** Focus on critical discovery flows, not implementation-detail
   snapshots. This prevents broken user journeys without prematurely defining the
   MVP.

## Verification Results

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
- Application tests: passed with `npm run test:app`; one scaffold baseline test
  succeeded.
- Export: passed with `npm run export`; Expo produced Web, iOS, and Android
  bundles.
- Expo Web development server: started successfully and returned HTTP 200.
