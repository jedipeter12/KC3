# Decision Log

Use this file for decisions that would matter to a future developer or AI agent.

Do not log every minor implementation choice. Log decisions where someone might reasonably ask later: "Why did we do it this way?"

---

## Decision Template

### YYYY-MM-DD — Decision Title

**Status:** Proposed / Accepted / Superseded / Reversed

**Decision**

What was decided?

**Context**

What problem or constraint led to this decision?

**Alternatives considered**

- Option A
- Option B

**Reasoning**

Why was this option selected?

**Consequences**

What does this decision make easier, harder, required, or intentionally unavailable?

**Follow-up**

- 

---

## Decisions

Add new decisions below this line, newest first.

### 2026-09-22 — Return a derived place-local weekday without exposing timezone

**Status:** Accepted

**Decision**

Add nullable `place_local_day_of_week` to the anonymous place-detail operation.
Compute it server-side from the accepted place timezone and current instant; do
not expose the timezone itself or ask the client to infer a day from its clock.

**Context**

KC3-29 requires today's regular-hours intervals before the full weekly schedule.
KC3-30 correctly keeps the place timezone private but returned only weekday
rows, so a client outside the place timezone could not identify the place-local
current day accurately.

**Alternatives considered**

- Use the device's local weekday.
- Expose the IANA place timezone.
- Omit the Today presentation.

**Reasoning**

A derived integer is the smallest deterministic input for the approved UI. It
preserves the timezone privacy boundary and avoids a client guess that becomes
wrong around midnight or when a user is outside Kansas City.

**Consequences / follow-up**

The detail projection has one additive nullable field and its exact-shape tests
must include it. Places without a timezone return null and omit the Today block;
their complete schedule, when available, remains present.

### 2026-09-22 — Add compatible purpose-specific anonymous place projections

**Status:** Accepted

**Decision**

Keep `list_public_places()` unchanged while adding
`list_public_place_summaries()` and `get_public_place_detail(uuid)` behind the
existing constrained reader role. Put card/filter fields in the summary and the
complete effective weekly schedule plus seating notes in detail. Return typed
states and timestamps, not English display copy. Compute current hours and KC3
verification freshness server-side using the accepted place timezone, without
exposing that timezone. Validate non-null canonical timezones when written and
validate existing values once during migration; do not scan PostgreSQL's
timezone catalog once per returned place.

Resolve regular hours through active complete override, complete KC3 base
schedule, complete Google schedule, then unavailable. Preserve the selected
schedule's observation time independently from provider fetch time. Add explicit
address precision, separate nullable drive-thru fields, and a database constraint
that drive-thru-only true requires drive-thru availability true.

**Context**

KC3-29 approved a list/detail split and exact freshness semantics. The current
five-field client is working and KC3-31 has not yet implemented the new UI, so an
in-place breaking response change would couple the database migration to an
unfinished client. Open-now and 180-day verification states require the place
timezone, but that internal evaluation input is explicitly excluded from the
anonymous response.

**Alternatives considered**

- Replace the existing five-field function immediately.
- Return one oversized projection containing full schedules and seating for all
  list rows.
- Expose the place timezone and make every client implement freshness and
  current-state calculations.
- Return preformatted English open/closed and verification strings.
- Treat provider fetch time as schedule observation or KC3 verification.
- Infer drive-thru or address precision in the client from provider categories
  or address punctuation.

**Reasoning**

Separate operations minimize list payloads and preserve a rollback-safe consumer
boundary. Server-side time-zone evaluation gives mobile and Web identical
boundary behavior while typed states keep presentation in KC3-31. A constrained
function owner can read only the columns needed for the approved outputs, so
expanding usefulness does not require base-table access or privileged client
credentials. Explicit storage constraints keep unknown and impossible
drive-thru combinations from becoming UI heuristics. Write-boundary timezone
validation keeps invalid identifiers out of storage without adding a catalog
scan to every summary row.

**Consequences / follow-up**

KC3-31 may adopt the new operations without changing storage or authorization.
Until then, both public contracts coexist and the live screen continues to use
the original function. The public reader now has column-level access and active-
row RLS policies for approved details, hours, and overrides, while Data API roles
still have no direct table privileges. Rollback after KC3-31 must coordinate the
client and database versions. The exact contract is documented in
[`KC3_30_PUBLIC_PLACE_CONTRACT.md`](KC3_30_PUBLIC_PLACE_CONTRACT.md).

### 2026-09-21 — Approve a source-aware place summary and details experience

**Status:** Accepted

**Decision**

Expand the approved product boundary after the initial five-field list slice to
include a compact place summary, dedicated place details, effective regular
hours/open state, KC3 suitability facts, and richer local filters. Preserve the
anonymous, read-only, active-only, three-city boundary. Keep full schedules and
nuanced amenity states on detail; keep cards to identity, address, usable hours,
at most three KC3 highlights, verification state, and a drive-thru-only warning.

Use explicit positive, negative, unknown/unverified, unavailable, and stale
states. Hours become stale after 14 full days from the effective schedule's
observation; KC3 details become stale after 180 calendar days from KC3
verification. Provider fetch is never KC3 verification. Model drive-thru
available and drive-thru only as separate nullable KC3 facts, hide verified
drive-thru-only places by default, and do not infer seating from a false
drive-thru-only value.

Approve external Open in Maps from details without adding a KC3 map browsing
surface. Defer ratings, price, website, phone number, live/special hours,
provider metadata, and heuristic provider-data cleanup. The complete normative
contract is [`KC3_29_PLACE_EXPERIENCE.md`](KC3_29_PLACE_EXPERIENCE.md).

**Context**

KC3-28 produced a verified 164-place snapshot and exposed the limits of an
identity-only list. Direct review found 159 stored regular schedules, only 15
unknown/unverified KC3 detail shells, no verified KC3 detail row, long and
unusual presentation values, missing schedules, split and overnight intervals,
24-hour sentinels, and ambiguous sub-places. Product behavior must remain useful
without turning those gaps into fabricated facts.

**Alternatives considered**

- Continue presenting only the five identity fields and defer suitability and
  details indefinitely.
- Put all fields and full weekly schedules on every list card.
- Treat missing KC3 values as no/false or fill them from provider categories.
- Use one generic freshness timestamp for provider and KC3-owned claims.
- Model drive-thru-only as another label for drive-thru availability.
- Add a map surface, ratings, or broad provider metadata with the detail screen.

**Reasoning**

The verified dataset is large enough that full-detail cards are difficult to
scan, while identity-only cards do not answer whether a place fits a user's
needs. A summary/detail split gives the list a clear job and leaves nuance,
weekly intervals, and provenance to the detail screen. Explicit unknown,
negative, and stale language prevents the current absence of KC3 verification
from becoming fabricated facts. Separate freshness domains preserve the approved
ownership model. Separate drive-thru facts distinguish a useful amenity at a
sit-in place from a location that cannot function as a third place.

**Consequences / follow-up**

KC3-30 must add the least-privilege anonymous summary/detail contract, address
precision, freshness semantics, and separate nullable drive-thru fields with
authorization tests. KC3-31 must implement the responsive list/detail UI and its
automated and manual accessibility verification. The current five-field RPC and
client remain valid until those tickets land. Provider anomalies require
reviewed source correction rather than UI heuristics. No database or UI code is
changed by this decision.

### 2026-09-20 — Reconcile provider identities through explicit atomic attachments

**Status:** Accepted

**Decision**

Permit the manual Google importer to accept an explicit reviewed mapping from one
Google Place ID to one existing KC3 UUID. Lock and attach that identity in a
server-only wrapper, then invoke the existing normalized import in the same
transaction. Also report query page/selection caps and allow an explicit
operator `create` resolution for a deterministic duplicate false positive.
Never infer an attachment from name alone or perform an automatic fuzzy merge.

**Context**

KC3-25 intentionally stopped at duplicate reporting. KC3-27 must transition the
15 representative seed records to provider-backed identities without creating a
second canonical record and without hand-writing provider rows. The live bounded
run also needs evidence for all 18 city/category queries and honest cap reporting.

**Alternatives considered**

- Update seed Google IDs or provider tables manually in SQL.
- Automatically merge provider results using fuzzy names or proximity.
- Delete the seed and let Google imports create unrelated new KC3 UUIDs.
- Attach the provider identity in one transaction and import metadata in another.

**Reasoning**

An explicit mapping makes the operator decision reviewable while preserving the
stable KC3 identity and KC3-owned details. One database transaction prevents a
failed import from leaving a provider identity without matching source/fetch
metadata. Cap reporting distinguishes bounded discovery from exhaustive
coverage.

**Consequences / follow-up**

Operators must run and inspect dry-run output, pass reviewed resolutions back to
the identical bounded command, and audit the result. Database reset still returns
to the representative seed; recreating the real local dataset requires rerunning
the documented provider procedure. Moved-place resolution remains separate work.

### 2026-09-19 — Distinguish provider freshness from stored-schedule observation

**Status:** Accepted

**Decision**

Use `place_google_data.google_fetched_at` as the latest successfully committed,
validated Google response time. Use a Google `place_hours.source_observed_at` as
the response time that produced the currently stored regular schedule. When a
valid refresh omits regular hours or returns an unchanged normalized schedule,
preserve the existing hour rows and their observation time while advancing
`google_fetched_at`. Do not add current, special, secondary, or open-now hours to
KC3-26.

**Context**

KC3-26 requires deterministic Google weekly-hours persistence and source/fetch
metadata without treating provider activity as KC3 verification. KC3-25 already
implemented the accepted KC3-24 transaction and ownership rules, but the two
provider timestamps needed an explicit semantic distinction and end-to-end
coverage.

**Alternatives considered**

- Delete and recreate unchanged Google hours solely to advance their row-level
  observation timestamps.
- Treat `source_observed_at` or `google_fetched_at` as KC3 verification.
- Expand the provider mask and schema to current, holiday, secondary, or
  open-now hours.

**Reasoning**

Preserving unchanged rows makes repeat imports deterministic and avoids
meaningless row churn. The listing-level timestamp still proves that KC3
successfully validated a newer provider response, while the row-level timestamp
identifies the response that established the stored schedule. Keeping provider
freshness separate prevents automated imports from overstating human KC3
verification. Richer time-sensitive hours are separate product behavior and are
not required by the KC3-26 ticket.

**Consequences**

No schema or production-code change is required for KC3-26. Reads that need the
latest provider contact use `google_fetched_at`; audits of the current stored
schedule use `source_observed_at`; KC3 verification continues to use KC3-owned
fields. A future current/special-hours feature requires its own approved storage,
retention, refresh, and display contract.

**Follow-up**

- Build the real Johnson County dataset through the verified operator workflow.

### 2026-09-08 — Use a dry-run-first CLI and constrained transactional RPC for Google ingestion

**Status:** Accepted

**Decision**

Run Google discovery manually from a TypeScript CLI that requires allowlisted
MVP city and KC3 category bounds, limits pages and total unique places, and
defaults to dry-run. Use Text Search only for `places.id` and
`nextPageToken`, pair each category with a strict supported Google discovery
type, fetch every selected record with KC3-24's exact Place Details mask, and
build the normalized change plan in memory. Persist each place through
a server-only JSON RPC owned by a constrained `NOLOGIN` database role and
executable only by `service_role`. The RPC accepts only the normalized allowlist,
serializes on Google Place ID, and has no privilege over KC3 details, overrides,
or KC3-owned hours.

**Context**

KC3-25 requires a repeatable operator command, atomic stable-identity upserts,
and server-only credentials without expanding the anonymous Expo API. KC3-24
already defines transformation and ownership policy but intentionally did not
select an execution boundary.

**Alternatives considered**

- Put Google or privileged Supabase access in the Expo client.
- Give the CLI direct unrestricted table access through a PostgreSQL connection.
- Store Text Search's broad place payload directly instead of fetching details
  with the accepted field mask.
- Automatically attach duplicate candidates or moved listings.
- Schedule imports or call Google from CI.

**Reasoning**

The CLI keeps billable calls and credentials in an attended operator process.
Required bounds and write opt-in make scope and mutation explicit. A constrained
function provides PostgreSQL transactionality while preserving the existing
table revocations and unchanged public client type. Separate discovery and
details masks keep search continuation possible without defining a second
retained-data policy. Review cases remain non-destructive.

**Consequences / follow-up**

Operators must provision the Google key and Supabase service-role key locally,
review dry-run output, and opt into writes. Normal CI remains fully mocked and
credential-free. Duplicate attachment and move resolution require a later
explicit operator workflow; KC3-26 and KC3-27 may now build on this boundary.

### 2026-09-08 — Define a source-preserving Google Places ingestion contract

**Status:** Accepted

**Decision**

Use Google Place ID only as a unique provider identity under KC3's UUID. Keep
allowlisted provider values in `place_google_data`, accepted physical-place facts
in `places`, KC3 suitability data in `place_details`, source-tagged weekly
schedules in `place_hours`, and non-destructive effective-dated manual values in
`place_overrides`. Use deterministic text and location comparison, regular weekly
hours only, explicit operator review for substantive changes/duplicates, and one
transaction per place refresh or resolved move. Do not retain unrestricted raw
responses or request phone/atmosphere fields in the MVP workflow.

The full field mapping and state machine are normative in
[`GOOGLE_INGESTION_CONTRACT.md`](GOOGLE_INGESTION_CONTRACT.md).

**Context**

KC3-25 needs to build a manual Google importer without inventing product policy.
The original schema separated ownership but lacked provider coordinates,
timezone, move linkage, all approved metadata, and effective-dated overrides.

**Alternatives considered**

- Make Google Place ID the canonical primary key or overwrite all canonical data
  from each response.
- Store a single mutable value without retaining the provider value under manual
  overrides.
- Treat a moved business as the same physical KC3 place.
- Retain complete Google payloads or request broader atmosphere fields.
- Use fuzzy/AI matching for names, addresses, and duplicates.

**Reasoning**

The selected model preserves KC3's durable physical-place identity and
independent enrichment while still allowing factual provider refreshes.
Deterministic normalization and conservative operator review are reproducible.
Separate provider and override values prevent refreshes from destroying KC3
judgment. Allowlisted storage reduces privacy, licensing, cost, and accidental
API-expansion risk.

**Consequences / follow-up**

KC3-25 must implement the documented validation, dry-run/report, duplicate
resolution, and transaction behavior through a trusted credential boundary. It
must not write KC3 details, use live/current/special hours, delete places, or
retain raw responses. A public effective-value API, import role, UI, scheduling,
and raw-data retention remain separate work.

### 2026-09-06 — Use GitHub Actions for verification CI

**Status:** Accepted

**Decision**

Run separate application and database verification jobs in GitHub Actions using
Ubuntu 24.04, the repository Node pin, npm 11.19.0, the npm lockfile, and full
commit pins for external actions. Trigger checks on pull requests and main/codex
branch pushes. Use disposable local Supabase for database and HTTP tests and
inert public placeholders for Expo exports.

**Context**

KC3-22 calls for reproducible CI after the application and database commands have
stabilized. The repository already lives on GitHub.

**Alternatives considered**

- Another CI provider requiring a separate integration.
- A single combined job or testing against a hosted Supabase project.

**Reasoning**

GitHub Actions attaches results directly to review. Separate jobs let application
checks run independently of Docker startup. A local database exercises the real
migrations, seed, and anonymous HTTP boundary without production credentials.

**Consequences / follow-up**

CI verifies exports but does not deploy or produce signed native builds. Hosted
runner images and Docker registries remain external availability dependencies.
GitHub branch protection must separately require both job names to enforce merge
gating. Maintain action/runtime pins and validate workflow changes with passing
and intentional-failure runs.

### 2026-09-05 — Test user-facing components with React Native Testing Library

**Status:** Accepted

**Decision**

Use React Native Testing Library with the existing Jest Expo preset for focused
component behavior tests. Keep data access injectable at screen boundaries when
that permits deterministic state testing without replacing the production data
layer.

**Context**

The first public place-list screen introduces asynchronous loading, ordered
content, empty results, errors, and retry behavior that should be protected at
the rendered component boundary. The scaffold selected Jest but intentionally
left UI test utilities open until user-facing components existed.

**Alternatives considered**

- Test only extracted state-management functions without rendering React Native
  components.
- Introduce an end-to-end framework for the first screen.

**Reasoning**

React Native Testing Library exercises behavior through visible text, roles, and
interactions while remaining compatible with the selected Jest Expo stack. It is
small enough for ticket-level component coverage; end-to-end tooling would add
more infrastructure than this slice requires.

**Consequences**

User-facing state transitions can be tested without live Supabase calls.
Component tests use the library's asynchronous render and event APIs. A future
end-to-end framework remains a separate decision.

**Follow-up**

- Reuse this component-testing pattern for the approved search and filter ticket.
- Select end-to-end tooling only when a broader workflow requires it.

### 2026-09-05 — Scaffold Expo SDK 57 with repository-level quality tooling

**Status:** Accepted

**Decision**

Use the stable Expo SDK 57 blank TypeScript foundation with a root `index.ts`,
application code under `src/`, and application tests under `tests/`. Standardize
local development on Node.js 24.20.0 LTS and npm 11.19.0 with the committed npm
lockfile. Use strict TypeScript, Expo's ESLint flat configuration, Prettier, and
Jest with `jest-expo` as the initial application quality toolchain.

**Context**

The approved list-first slice needs the smallest supported mobile and Web client
before its Supabase data path or UI can be implemented. Existing database scripts
must remain usable and separate from application-only checks.

**Alternatives considered**

- Adopt Expo Router and its default multi-screen example before a navigation
  requirement exists.
- Place application source at the repository root.
- Introduce a different test runner or formatter instead of Expo's documented
  Jest baseline and the established Expo lint configuration.

**Reasoning**

The blank scaffold proves all three approved targets with minimal generated code
and avoids prematurely selecting navigation. The `src/` and `tests/` separation
keeps future features and their tests discoverable. Expo's documented compatible
toolchain minimizes custom configuration; ESLint stays on the Expo-compatible 9.x
line until the Expo configuration supports ESLint 10.

**Consequences**

Developers use the pinned Node/npm versions and npm lockfile. Application checks
are available as dedicated scripts, while the existing `npm test`, `test:db`, and
`lint:db` database behavior remains unchanged. UI test utilities were selected
when the first user-facing screen was implemented; navigation, coverage targets,
CI, hosting, and signed native builds remain later decisions.

**Follow-up**

- Configure the public Supabase client and environment variable contract.
- Select CI, hosting, and release tooling in their approved tickets.

### 2026-09-05 — Use Notion as a subordinate execution tracker

**Status:** Accepted

**Decision**

Use the directly linked KC3 Work/Tickets Notion database for detailed ticket
scope, acceptance criteria, dependencies, priority, status, and progress history.
Keep `docs/ROADMAP.md` as the source of truth for project scope, priorities, and
status. Limit KC3 Notion access to that database and its ticket pages rather than
searching unrelated workspace content.

**Context**

The repository-centered workflow preserves durable product knowledge, while a
structured tracker makes implementation sequencing and history easier to review.

**Alternatives considered**

- Track all execution detail only in `ROADMAP.md`.
- Make Notion the authoritative project backlog.

**Reasoning**

A subordinate tracker adds useful operational structure without splitting or
reversing the repository's authority. The explicit access boundary avoids pulling
unrelated personal workspace context into KC3.

**Consequences**

Roadmap changes must be mirrored to Notion when relevant, and conflicts are
resolved in favor of the repository. Ticket pages may contain more execution
detail than the roadmap, but they cannot approve or redefine product scope.

**Follow-up**

- Keep ticket status synchronized whenever roadmap work starts or finishes.

### 2026-09-05 — Approve a list-first Expo MVP slice

**Status:** Accepted

**Decision**

Make the first Expo client slice an anonymous list of active places using the
existing `list_public_places()` RPC. Display name, city, address, and place type;
add client-side name search and city/place-type filters; and provide loading,
empty, and sanitized error states. Target mobile and Expo Web. Exclude maps,
accounts, writes, hours, Google metadata, and place-detail screens from this
slice.

**Context**

The backend now exposes a tested five-field public read contract, but no client
exists. A bounded vertical slice is needed before richer data or experiences are
approved.

**Alternatives considered**

- Include a map and place-detail experience in the first slice.
- Scaffold the client without an approved user-facing slice.
- Require accounts before discovery.

**Reasoning**

The list-first slice validates the complete client-to-database path with the data
already available. Client-side filtering is sufficient for the 15-record seed and
does not broaden the public database boundary.

**Consequences**

The first client must use the RPC rather than base tables and must not expose
privileged credentials. Maps and richer details require later product approval
and, where needed, explicit backend contract changes with authorization tests.

**Follow-up**

- Scaffold Expo and select the initial application testing and quality tooling.
- Implement and verify the list-first tickets in roadmap order.

### 2026-09-05 — Expose active places through a narrow anonymous RPC

**Status:** Accepted

**Decision**

Allow unauthenticated clients to list active places without creating an account.
Expose only place ID, name, city, address, and place type through the zero-argument
`public.list_public_places()` RPC. Grant `anon` permission to execute that RPC,
but retain the existing revocation of all direct base-table privileges and all
client writes.

Run the RPC as a dedicated `NOLOGIN`, `NOBYPASSRLS` role. Give that role column-
level read access only to the five returned fields plus `status`, and apply an RLS
policy that permits it to see only `active` places. Keep `authenticated` and
`service_role` access closed until a use case for either role is approved.

**Context**

The approved schema and local seed are ready for a first client query, but all
Data API access was intentionally closed. The first useful client slice needs a
small place identity projection without exposing hidden records, Google payloads,
verification notes, lifecycle metadata, or privileged credentials.

**Alternatives considered**

- Grant anonymous clients direct column-level access to `places` with RLS.
- Expose an automatically updatable database view.
- Put the first read behind a separate server or API layer.
- Require accounts before any place discovery.

**Reasoning**

An RPC keeps storage tables out of the client contract and allows an explicit,
stable response shape. A constrained function owner lets RLS remain effective
without giving `anon` direct table privileges. Anonymous read-only discovery is
the smallest useful access boundary and avoids premature authentication, server,
and write-path complexity.

**Consequences**

Clients must call `list_public_places` rather than query `places`. Only active
records and the five approved fields are returned. Place details, hours, Google
metadata, raw payloads, statuses, audit timestamps, authenticated access, and all
writes remain unavailable. Any expansion of this contract requires an explicit
migration and matching authorization regression tests.

**Follow-up**

- Review and merge the migration and its pgTAP coverage.
- Approve the first Expo place-list experience before scaffolding feature code.
- Define a separate server-controlled administrative and import boundary.

### 2026-09-05 — Keep the local MVP seed additive and ownership-safe

**Status:** Accepted

**Decision**

Use `supabase/seed.sql` to load 15 representative, real places across Lenexa,
Overland Park, and Olathe for local development. Give every seed place a stable
UUID, wrap the complete seed in one transaction, and use insert-only conflict
handling. Seed canonical place values and unknown/unverified KC3 detail shells,
but do not populate Google-owned fields or weekly hours.

**Context**

The database needs realistic records before client list and search work can be
validated. The schema intentionally separates canonical, Google-owned, and
KC3-owned data, while the production import and curation path, Google payload
retention, and canonical deduplication policy remain undecided.

**Alternatives considered**

- Update seed-managed rows to the file's latest values on every reset.
- Seed current business hours, ratings, or other Google-derived metadata.
- Wait for the production Google import workflow before adding local data.

**Reasoning**

Stable IDs make repeated local execution deterministic. Treating existing rows
as authoritative prevents a reset or manual rerun from erasing curation. Empty
Google data and unknown KC3 details avoid presenting unverified facts as known,
while the representative records are sufficient for early database and client
development.

**Consequences**

Seed-file corrections do not replace an already-present row; developers must
apply intentional corrections separately or reset the disposable local database.
The seed is not a general deduplication solution or a production import path.
Hours, ratings, coordinates, Google IDs, and richer KC3 details remain absent
until source-aware workflows or explicit curation supply them.

**Follow-up**

- Define and approve the production administrative/import boundary.
- Define Google payload retention and refresh rules before ingestion.
- Expand or correct the seed only from authoritative sources and update its
  regression test in the same change.

### 2026-08-23 — Test the approved database model with pgTAP

**Status:** Accepted

**Decision**

Use pgTAP tests executed by the repository-pinned Supabase CLI for regression
coverage of the approved MVP database migration. Keep database behavior tests in
`supabase/tests/` and run them against a reset local Supabase PostgreSQL instance.

**Context**

The database migration is KC3's only implemented product behavior. It contains
important constraints, defaults, ownership boundaries, triggers, and security
settings that static review alone cannot reliably protect. No client application
or application-test stack exists yet.

**Alternatives considered**

- Rely on migration review without executable regression tests.
- Add a general JavaScript or TypeScript test framework before application code
  exists.
- Test PostgreSQL behavior through mocks or SQL string inspection.

**Reasoning**

pgTAP exercises the real PostgreSQL behavior managed by Supabase and requires no
application test framework. It can verify database contracts and failure paths
without defining unapproved client behavior.

**Consequences**

Database tests require a Docker-compatible runtime and a local Supabase stack.
Future database migrations must keep the suite current. Application, API, and UI
test tooling remain separate decisions to make when those layers exist.

**Follow-up**

- Run the database tests and PostgreSQL lint checks in CI once CI is selected.
- Select application-test tooling during Expo scaffolding.

### 2026-08-21 — Approve the normalized KC3 MVP place data model

**Status:** Accepted

**Decision**

Use four public PostgreSQL tables for the initial KC3 data foundation: `places`
for canonical physical-place identity, `place_google_data` for Google-derived
metadata, `place_details` for KC3-owned workability information, and `place_hours`
for repeatable weekly schedule intervals. Use PostgreSQL enums for bounded
classifications, cascading foreign keys for dependent records, automatic
`updated_at` triggers, and Row Level Security without permissive policies until
access rules are separately approved.

**Context**

The initial schema must preserve the distinction between canonical, externally
sourced, KC3-verified, and repeating hours data. It also needs to support unknown
values and multiple opening intervals on the same day without prematurely opening
API access.

**Alternatives considered**

- Keep all source, detail, and hours fields in one `places` table.
- Allow only one hours row per place and day.
- Add permissive read or write policies with the initial tables.

**Reasoning**

Separate tables make ownership and refresh behavior explicit, while shared
primary keys enforce one-to-one source/detail records. Independent hours rows
support split schedules. Enabling RLS before policies establishes a closed default
until application access requirements are approved.

**Consequences**

Deleting a place deletes its Google data, details, and hours. Ordinary Supabase
API clients cannot access the tables until policies are added. Google ingestion,
seed data, and application queries must follow the ownership boundaries in this
schema.

**Follow-up**

- Review and merge the migration without applying it to production.
- Define roles and least-privilege RLS policies before client data access.
- Define import and seed workflows separately.

### 2026-08-19 — Use a supervised, repository-centered delivery workflow

**Status:** Accepted

**Decision**

The Product Owner decides what KC3 should do. ChatGPT may help translate product
intent into requirements, architecture, scope, acceptance criteria, and tickets.
Codex implements scoped tickets, runs appropriate checks, and reports its changes.
Settled knowledge belongs in the repository, with `ROADMAP.md` serving as the PM
backlog. Work should be divided into small, reviewable tickets.

The expected flow is:

`idea or decision → repository documentation → scoped Codex ticket → implementation and tests → Product Owner review`

**Context**

KC3 is intended to establish a repeatable product-to-deployment workflow without
depending on conversation memory.

**Alternatives considered**

- Rely primarily on chat history for product and technical context.
- Begin with autonomous multi-agent orchestration.

**Reasoning**

Repository documentation provides durable, reviewable context. A supervised flow
keeps product decisions with the Product Owner while the basic workflow is being
proven.

**Consequences**

Important decisions and completed work must update the relevant documentation.
Autonomous multi-agent orchestration is not required and may be reconsidered only
after the supervised workflow is mature.

**Follow-up**

- Keep roadmap status current as tickets are started, completed, deferred, or
  reprioritized.

### 2026-08-19 — Adopt the initial TypeScript, Expo, and Supabase stack

**Status:** Accepted

**Decision**

Use TypeScript for application logic, React Native with Expo for the client, Expo
Web for the initial web target, and Supabase for backend services. Use Supabase
Database (PostgreSQL) for persistent data, Supabase Auth for authentication, and
Supabase Storage if object storage is needed.

**Context**

KC3 needs an approved working baseline before implementation begins. The source
conversation records the stack as approved but does not preserve a full technology
comparison.

**Alternatives considered**

- Swift or native Apple code as the primary implementation.
- A separate web-oriented React framework, such as Next.js, for the initial web
  client.
- Other backend platforms; specific candidates were not recorded.

**Reasoning**

The chosen baseline supports the planned mobile and initial web targets while
keeping new application logic in TypeScript. It also avoids splitting the client
architecture before a concrete requirement justifies doing so.

**Consequences**

Another language, replacement framework, replacement backend, framework migration,
or architectural rewrite requires explicit approval. Native code is allowed only
for a specific requirement. A separate web frontend may be reconsidered if public
search discoverability becomes important.

**Follow-up**

- Decide the MVP before defining the data model or scaffolding feature modules.
- Select hosting, testing, and release tooling during implementation planning.

### 2026-08-19 — Build KC3 before the Lyfe project

**Status:** Accepted

**Decision**

Use KC3 as the first ChatGPT/Codex build. Keep the Lyfe project parked/configured
for now.

**Context**

A first project was needed to learn the full product-to-deployment workflow.

**Alternatives considered**

- Start implementation with the Lyfe project.

**Reasoning**

KC3 is expected to have a comparatively clear MVP boundary and provides a
practical way to establish the workflow.

**Consequences**

KC3 product definition and delivery take priority. This decision does not define
KC3's feature-level MVP.

**Follow-up**

- Approve a bounded KC3 MVP before implementation.
