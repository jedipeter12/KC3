# Architecture

## Current Architecture Summary

KC3 is in product definition and has no application scaffold or deployed
architecture yet. The approved target is a TypeScript application built with
React Native and Expo, with Expo Web as the initial web target. Supabase will
provide the backend platform, PostgreSQL-based database, and authentication.
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
└── LICENSE
```

There are no application modules or tests yet. Record their actual structure
here after the Expo project is scaffolded.

## Major Components

- Expo client: Approved platform; component boundaries are not designed yet.
- Supabase backend: Approved platform for backend services, database, and
  authentication; schemas and service boundaries are not designed yet.

## Data Model

No data model has been approved. Candidate place fields discussed during product
exploration remain tentative and must not be treated as a schema specification.

## APIs / Integrations

Supabase is the only approved integration. Authentication details, data exchanged,
and failure behavior will be documented when the relevant MVP features and schema
are approved.

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
- Authorization boundaries: Not designed; define them before protected data or
  write operations are implemented.
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
- What data model follows from the approved MVP rather than from tentative feature
  ideas?

## Explicitly Unapproved Alternatives

- A separate web-oriented React framework such as Next.js may be evaluated later
  if public search discoverability becomes important. It is not an approved
  replacement for Expo Web.
- Swift or other native Apple code may be introduced only when a specific approved
  requirement makes it necessary.
