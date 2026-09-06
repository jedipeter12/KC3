# Architecture

## Current Architecture Summary

KC3 has an Expo SDK 57 TypeScript client scaffold targeting React Native and Expo
Web, but no deployed architecture yet. Application code lives in `src/`, a root
entry point registers the app, and application tests live separately in `tests/`.
Supabase provides the backend platform and PostgreSQL-based database; the initial
MVP schema is defined as a migration but has not been applied to production. A transactional,
idempotent local seed bootstraps 15 representative places without importing
Google data or guessing KC3 details. A read-only Supabase RPC exposes the five
approved identity fields for active places to unauthenticated clients without
granting them base-table access. Supabase Auth is the selected authentication
platform if later approved features require accounts, and Supabase Storage may be
used if an approved feature needs object storage.

## Technology Stack

- Client: React Native with Expo; Expo Web is the initial web target.
- Server: Supabase.
- Database: Supabase Database (PostgreSQL).
- Authentication: Supabase Auth.
- Object storage: Supabase Storage, if needed.
- Hosting: Not selected.
- Analytics: Not selected.
- Third-party services: None selected beyond Supabase.

### Language
TypeScript

TypeScript is the default language for all application code. JavaScript may exist where required by tooling, but new application logic should be written in TypeScript.

### Mobile
React Native + Expo

### Web
Expo Web initially. A separate web frontend may be considered later if product requirements justify it.

### Backend
Supabase

### Database
PostgreSQL

## Repository / Module Structure

```text
KC3/
├── README.md
├── AGENTS.md
├── app.json
├── index.ts
├── package.json
├── tsconfig.json
├── eslint.config.js
├── src/
│   ├── App.tsx
│   └── config/
├── tests/
├── docs/
│   ├── PRODUCT.md
│   ├── ARCHITECTURE.md
│   ├── DECISIONS.md
│   ├── ROADMAP.md
│   ├── DEVELOPMENT.md
│   ├── SEED_DATA.md
│   ├── SECURITY_REVIEW.md
│   └── TESTING_REVIEW.md
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   ├── seed.sql
│   └── tests/
└── LICENSE
```

Client application modules live in `src/`, application tests live in `tests/`,
and database regression tests live in `supabase/tests/`. Generated Expo exports
use the ignored `dist/` directory.

## Major Components

- Expo client: Expo SDK 57 with React Native 0.86, React 19, and Expo Web. The
  scaffold uses a root `index.ts`, `src/App.tsx`, and feature-neutral
  configuration under `src/config/`. The first slice remains a read-only place
  list with client-side name search and city/place-type filters over the existing
  RPC; feature component boundaries are not designed yet.
- Supabase client: A typed `@supabase/supabase-js` singleton reads the public
  project URL and publishable key from Expo's `EXPO_PUBLIC_` environment
  boundary. Authentication session behavior is disabled because accounts are not
  part of the approved slice. Its TypeScript database contract exposes only the
  approved `list_public_places()` RPC and does not type base tables as client APIs.
  The public-place data layer calls that RPC, preserves its ordering, projects
  exactly the five approved fields, and converts provider or malformed responses
  to a stable application error without retaining provider details.
- Supabase backend: Approved platform for backend services, database, and
  authentication. The initial public place schema is defined in a versioned
  migration. The first anonymous read RPC is implemented; authenticated,
  administrative, import, and remaining service boundaries are not designed yet.

## Data Model

The approved MVP data model consists of four public tables:

- `places`: Canonical physical-place identity and lifecycle. It has a UUID primary
  key, required name/city/address/place type, optional unique Google Place ID, and
  an active-by-default status.
- `place_google_data`: Optional one-to-one Google-derived data for a place. Its
  shared primary key cascades on place deletion and it holds source fields, rating
  data, raw JSON, and refresh time.
- `place_details`: Optional one-to-one KC3 detail data for a place. Its shared
  primary key cascades on place deletion and it holds workability classifications,
  nullable verified/unknown booleans, notes, and verification date.
- `place_hours`: Zero-to-many weekly schedule rows for a place. Each row has its
  own UUID, cascades on place deletion, uses Sunday `0` through Saturday `6`, and
  records its Google or KC3 source. Multiple intervals for one place/day are
  intentionally allowed.

The public enum types are `place_type`, `place_status`, `outlet_level`,
`wifi_type`, `work_suitability`, `food_beverage_level`, and `hours_source`. All
four tables have creation/update timestamps; a shared trigger maintains
`updated_at` automatically. Hours checks require valid weekday numbers, null
times for closed rows, and both times for open rows.

Row Level Security is enabled on every table. Direct table privileges for `anon`,
`authenticated`, and `service_role` remain explicitly revoked. The only current
policy permits the dedicated `kc3_public_place_reader` role to select active rows
from `places`; it receives column-level access only to ID, name, city, address,
place type, and status. The role is `NOLOGIN` and cannot bypass RLS. Default
public-schema privileges for `postgres`-owned project migrations remain revoked
so future project tables, sequences, and functions require intentional grants.

The local MVP seed uses stable UUIDs and insert-only conflict handling. It creates
canonical `places` rows and unknown/unverified `place_details` shells only when
they are missing. It does not update existing records, populate Google-owned
fields, or seed volatile weekly hours. See `SEED_DATA.md` for provenance and
maintenance rules.

## APIs / Integrations

Supabase is the only approved integration. Anonymous clients may execute
`public.list_public_places()` through the Supabase RPC API. The zero-argument RPC
returns active places ordered by name and ID with exactly `id`, `name`, `city`,
`address`, and `place_type`. Its dedicated security-definer owner has only the
source access required by that contract, and `anon` has no direct table access.
The Expo client initializes `@supabase/supabase-js` with that narrow database type
and with authentication persistence, token refresh, and URL session detection
disabled. Its `listPublicPlaces()` data-layer operation treats an empty array as
a successful empty result. Null, non-array, malformed, rejected, and provider-
error responses throw `PublicPlacesError` with the
`PUBLIC_PLACES_UNAVAILABLE` code and a sanitized retry message.

The schema can retain Google-derived metadata, but ingestion behavior and direct
Google API integration are not defined. Authentication details and remaining
failure behavior will be documented when their relevant features are approved.

## Authentication and Authorization

Supabase Auth is the approved authentication service, but accounts are not
required for the approved public place query. Signup remains disabled. Identity
flows and authenticated authorization rules remain undefined because no account-
based feature is approved. The PostgreSQL `anon` Data API role does not enable
Supabase anonymous-user sign-ins.

## Data Storage

Persistent application data will use Supabase Database. Local database resets
load `supabase/seed.sql` after migrations. Supabase Storage is available if
required. Retention, backup, and deletion policies have not been decided.

## Security Considerations

- Secret handling: The Expo bundle may contain only
  `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, both of
  which are public identifiers protected by the database authorization boundary.
  Service-role/secret keys and direct database credentials must never enter the
  client bundle or repository.
- Input validation: Not designed.
- Authorization boundaries: All public tables have RLS enabled and no Data API
  role has direct table privileges. Anonymous access is limited to executing the
  approved active-place RPC; its constrained owner is filtered by RLS. Add an
  explicit migration and role-focused tests before expanding reads or enabling
  any client write.
- Authentication: Account signup is disabled in the local configuration because
  accounts are not approved. Production auth requirements remain undecided.
- Sensitive-data handling: Not designed.
- Logging considerations: Not designed.

See `SECURITY_REVIEW.md` for the current risk assessment and pre-launch controls.

## Error Handling

Supabase client initialization validates required public configuration and the
project URL before creating the client. Configuration failures identify the
missing or invalid variable by name, point developers to `.env.example`, and do
not echo configured values. Public-place reads normalize provider failures and
unexpected response shapes to the same safe application error. The data layer
does not log or retain provider errors, response details, credentials, or URLs.

## Testing Strategy

- Database tests: pgTAP tests run against the local Supabase PostgreSQL instance.
  They protect the approved schema contract, constraints, defaults, relationships,
  timestamp triggers, seed contract, and public RPC/RLS/privilege boundary.
- Unit tests: Jest with the `jest-expo` preset provides the application unit-test
  baseline. Focused data-layer tests cover successful ordered results, exact
  field projection, empty results, malformed responses, and sanitized provider
  failures. Coverage expectations are not yet selected.
- Integration tests: Database migration tests are established; API and client
  integration tooling is not selected.
- UI / end-to-end tests: Not selected.
- Static quality checks: TypeScript strict typechecking, Expo's ESLint flat
  configuration, and Prettier formatting checks run from npm scripts.

Relevant tests must be added or updated whenever behavior changes.

## Deployment / Release Architecture

Not designed. Hosting, environments, CI, and release channels remain open
decisions.

## Known Technical Debt

- The typed public-place operation is not yet connected to a UI; loading, empty,
  and error presentation are the next ticket.

## Architecture Questions

- Which approved MVP features, if any, require Supabase Auth or Storage?
- What hosting and release path should be used for Expo Web and mobile builds?
- Which testing, linting, and formatting tools should be adopted?
- Which roles and interfaces are required for future authenticated and
  administrative access?

## Explicitly Unapproved Alternatives

- A separate web-oriented React framework such as Next.js may be evaluated later
  if public search discoverability becomes important. It is not an approved
  replacement for Expo Web.
- Swift or other native Apple code may be introduced only when a specific approved
  requirement makes it necessary.
