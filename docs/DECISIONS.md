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
