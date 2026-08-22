# Architecture

## Current Architecture Summary

KC3 is in product definition and has no client application scaffold or deployed
architecture yet. The approved target is a TypeScript application built with
React Native and Expo, with Expo Web as the initial web target. Supabase provides
the backend platform and PostgreSQL-based database; the initial MVP schema is
defined as a migration but has not been applied to production. Supabase Auth is
the selected authentication platform if approved features require accounts, and
Supabase Storage may be used if an approved feature needs object storage.

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
├── docs/
│   ├── PRODUCT.md
│   ├── ARCHITECTURE.md
│   ├── DECISIONS.md
│   ├── ROADMAP.md
│   └── DEVELOPMENT.md
├── supabase/
│   ├── config.toml
│   └── migrations/
└── LICENSE
```

There are no client application modules or tests yet. Record their actual
structure here after the Expo project is scaffolded.

## Major Components

- Expo client: Approved platform; component boundaries are not designed yet.
- Supabase backend: Approved platform for backend services, database, and
  authentication. The initial public place schema is defined in a versioned
  migration. API policies and remaining service boundaries are not designed yet.

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

Row Level Security is enabled on every table. No permissive policies exist yet,
so API access remains closed until explicit access rules are approved.

## APIs / Integrations

Supabase is the only approved integration. The schema can retain Google-derived
metadata, but ingestion behavior and direct Google API integration are not defined
by this migration. Authentication details, data exchanged, and failure behavior
will be documented when their relevant features are approved.

## Authentication and Authorization

Supabase Auth is the approved authentication service. User accounts are not yet an
approved MVP requirement, so identity flows, roles, and authorization rules remain
undefined.

## Data Storage

Persistent application data will use Supabase Database. Supabase Storage is
available if required. Local storage, retention, backup, and deletion policies
have not been decided.

## Security Considerations

- Secret handling: Do not commit credentials; required environment variables must
  be documented without values when the application is scaffolded.
- Input validation: Not designed.
- Authorization boundaries: All public tables have RLS enabled with no permissive
  policies. Define explicit policies before client reads or writes are enabled.
- Sensitive-data handling: Not designed.
- Logging considerations: Not designed.

## Error Handling

Not designed. Follow established project patterns once they exist and document a
shared strategy before introducing a new one.

## Testing Strategy

- Unit tests: Tooling and coverage expectations are not selected.
- Integration tests: Not selected.
- UI / end-to-end tests: Not selected.

Relevant tests must be added or updated whenever behavior changes.

## Deployment / Release Architecture

Not designed. Hosting, environments, CI, and release channels remain open
decisions.

## Known Technical Debt

- None yet; implementation has not started.

## Architecture Questions

- What application and test structure should the initial Expo scaffold use?
- Which approved MVP features, if any, require Supabase Auth or Storage?
- What hosting and release path should be used for Expo Web and mobile builds?
- Which testing, linting, and formatting tools should be adopted?
- Which RLS policies and roles are required for approved client and administrative
  access?

## Explicitly Unapproved Alternatives

- A separate web-oriented React framework such as Next.js may be evaluated later
  if public search discoverability becomes important. It is not an approved
  replacement for Expo Web.
- Swift or other native Apple code may be introduced only when a specific approved
  requirement makes it necessary.
