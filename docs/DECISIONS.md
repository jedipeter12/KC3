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
`lint:db` database behavior remains unchanged. Navigation, UI test utilities,
coverage targets, CI, hosting, and signed native builds remain later decisions.

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
