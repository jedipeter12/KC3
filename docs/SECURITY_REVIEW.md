# Defensive Security Review

**Review date:** 2026-08-23

**Scope:** Repository contents and Git history, Supabase migration and local
configuration, dependency metadata, documented architecture, and the controls
that must exist before KC3 has real users.

**Current project stage:** Product definition and initial backend migration. No
client, custom API endpoint, deployed environment, or production database exists
in this repository.

## Executive Security Assessment

KC3 has a good early-stage security foundation but is not ready to expose its
Data API or deploy to real users. The strongest current control is that all four
tables have Row Level Security enabled with no permissive policies. This review
also made the closed state independent of changing Supabase defaults by revoking
Data API privileges explicitly.

No critical vulnerability, committed credential, custom authentication flaw,
remote-code path, or known vulnerable npm dependency was found in the current
repository. The most important risks are pre-launch design gaps: the public data
boundary, administrative write/import path, privacy treatment of retained Google
payloads, production environment controls, backup/restore expectations, and any
future account model are not approved. Those gaps are safe only while the API
remains closed and there is no deployed application.

Security status by stage:

- **Safe for the current schema-review stage:** Yes. The migration applies from a
  clean local database, all 84 pgTAP assertions pass, and database lint reports no
  schema errors.
- **Safe to expose to an Expo client:** No. Explicit grants, RLS policies, and
  policy tests do not yet exist for any approved client use case.
- **Safe for production users:** No. Hosting, environment separation, secrets
  management, backups, monitoring, operational access, and release controls are
  not defined.

## Critical Findings

None found in the current repository.

## High-Risk Findings

### H-01 — Client authorization policy is intentionally undefined

All place tables are in the exposed `public` schema. RLS is enabled and client
privileges are now explicitly revoked, so the current state is closed. However,
there is no approved definition of which roles may read which statuses, rows, or
columns. A future blanket `select` grant and `using (true)` policy could expose
hidden records, raw upstream data, internal verification notes, or other fields
that were not intended for public use.

- **Current exploitability:** None through the Data API because privileges and
  policies deny access.
- **Threat mitigated by recommendation:** Unauthorized disclosure and accidental
  publication caused by an overbroad future policy.
- **Required timing:** **Immediate MVP blocker before the first client query.**
- **Disposition:** **PRODUCT OWNER DECISION REQUIRED.**

### H-02 — Administrative write and Google ingestion trust boundary is undefined

KC3 will need a trusted way to seed, curate, and possibly refresh place data. No
administrative workflow or server boundary exists. A Supabase secret/service-role
credential bypasses RLS and must never be embedded in Expo, Expo Web, a public
bundle, or other user-controlled runtime. A leaked credential would permit broad
read/write/delete access and cascading deletion of dependent records.

- **Current exploitability:** No credential or ingestion code exists.
- **Threat mitigated by recommendation:** Full database compromise through a
  client-exposed or overprivileged administrative secret.
- **Required timing:** **Immediate MVP blocker before seed/import automation.**
- **Disposition:** **PRODUCT OWNER DECISION REQUIRED.**

### H-03 — `raw_data` could cross the future public-data boundary

`place_google_data.raw_data` can retain arbitrary JSON from an upstream provider.
Its contents and retention are not defined. RLS is row-level, not a guarantee
that selected columns are safe. Exposing `place_google_data` directly or using
`select *` could disclose fields KC3 never reviewed, retain data longer than
needed, increase response size, and make future upstream schema changes silently
part of KC3's public API.

- **Current exploitability:** The table is inaccessible to client roles.
- **Threat mitigated by recommendation:** Privacy leakage, unnecessary data
  retention, oversized-response denial of service, and accidental API expansion.
- **Required timing:** **Before importing Google payloads or enabling public
  reads.**
- **Disposition:** **PRODUCT OWNER DECISION REQUIRED.**

### H-04 — Production security and recovery controls do not exist

The repository has no deployment configuration, CI/CD, environment separation,
remote Supabase configuration, backup/restore requirements, release approvals,
or operational access policy. The checked-in Supabase configuration is a local
development baseline and currently shows database network restrictions and SSL
enforcement as disabled. Those local values do not prove the state of a future
hosted project. Cascading foreign keys make an accidental or malicious place
deletion affect all dependent records, which increases the importance of tested
recovery.

- **Current exploitability:** No production environment is documented or linked.
- **Threat mitigated by recommendation:** Credential misuse, insecure direct
  database connections, environment mix-ups, destructive deployment, and
  unrecoverable data loss.
- **Required timing:** **Immediate MVP blocker before production deployment.**
- **Disposition:** Implementation can follow standard controls, but recovery
  objectives, hosting, cost, and operational ownership require Product Owner
  approval.

## Medium-Risk Findings

### M-01 — Auth defaults are not production-ready if accounts are enabled

Accounts are not an approved MVP requirement. Signup was enabled in the generated
local config while email confirmation, secure password changes, CAPTCHA, and
password complexity were not enabled; the minimum password length is six. This
review disabled general and email signup so the current no-account product state
fails closed. The remaining settings must not be accepted as a future production
auth design by default.

- **Threat:** Bot-created accounts, unverified identities, account takeover, and
  weak credential security.
- **Required timing:** **Before any account or authenticated feature is approved.**
- **Disposition:** **PRODUCT OWNER DECISION REQUIRED.**

### M-02 — Input and data-integrity limits are only partially defined

The migration uses enums, required fields, foreign keys, and basic hours checks.
It still accepts blank required text, out-of-range or negative Google rating
data, a closed row with `closes_next_day = true`, unbounded text/JSON,
unrestricted URL schemes, and schedules with undefined equal or overlapping-time
semantics. These rules were not tightened because the approved documents do not
establish the required behavior clearly enough.

- **Threat:** Corrupt schedules, unsafe links at output time, oversized rows,
  expensive queries/responses, and low-quality imported data.
- **Required timing:** Define application/API validation and payload limits
  **before client writes or automated imports**. Output-link validation is needed
  before opening stored URLs. Some database caps may wait until source data is
  sampled.
- **Disposition:** Business limits and hours semantics are **PRODUCT OWNER
  DECISION REQUIRED**; implementation should then enforce the approved rules at
  both the trusted ingestion boundary and database where practical.

### M-03 — Authorization regression coverage is incomplete

The repository now has pgTAP migration tests covering the schema, constraints,
triggers, closed RLS state, explicit grants, and deny-by-default privileges. RLS
mistakes often fail silently by returning too many or too few rows. Tests proving
the first approved anonymous/authenticated policy behavior and hidden-status or
column exposure cannot exist until that behavior is decided, and no CI currently
runs the database suite.

- **Threat:** A later policy or grant change silently opens data.
- **Required timing:** **Same change as the first grants/RLS policies; before
  client access.**
- **Disposition:** Current deny-by-default behavior is covered. Role/row/column
  access cases are intentionally left until approved so tests do not encode
  invented authorization requirements.

### M-04 — Internal and API objects share the exposed `public` schema

The four tables and trigger helper are created in a schema listed in the Data API
configuration. Explicit revokes now prevent current access, including direct
execution of the trigger function. As the system grows, keeping raw/internal
objects alongside intentional API objects raises the chance of accidental grants
or function exposure.

- **Threat:** Accidental API surface growth and exposure of internal tables or
  routines.
- **Required timing:** Not required to review the current MVP migration. Revisit
  **before adding multiple RPCs, internal tables, or client-write features**.
- **Disposition:** A schema split is an architecture decision and was not made in
  this review.

### M-05 — Privacy, retention, and deletion requirements are undocumented

`PRODUCT.md` explicitly states that privacy is not documented. Current fields are
mostly business/place data, but future raw imports, user accounts, submissions,
analytics, logs, location, or social features may introduce personal data. There
is no data classification, retention schedule, deletion process, or approved
logging boundary.

- **Threat:** Excess collection, indefinite retention, privacy-law exposure, and
  sensitive data appearing in logs or support tools.
- **Required timing:** **Before Google ingestion is retained and before any user
  data, analytics, or accounts are introduced.**
- **Disposition:** **PRODUCT OWNER DECISION REQUIRED.**

### M-06 — Direct database network and transport controls are undecided

The local config leaves database network restrictions disabled and does not
enable SSL enforcement. These are normal local-development defaults, not evidence
of a current public database. A future hosted project needs an explicit decision
about who needs direct Postgres access, which IP ranges are stable, and whether
all clients support enforced SSL.

- **Threat:** Broader brute-force/credential-stuffing surface and unencrypted
  direct database connections.
- **Required timing:** **Before production**, after the deployment and operator
  access path is known.
- **Disposition:** **PRODUCT OWNER DECISION REQUIRED** for access needs and cost;
  recommendation is SSL enforcement and the narrowest feasible network access.

## Low-Risk / Hardening Opportunities

- Add automated secret scanning and protected-branch checks before more people,
  CI credentials, or integrations are added. Ignore rules reduce accidents but
  are not a scanner.
- Pin the package manager/Node version and use `npm ci` in CI. The lockfile pins
  the current CLI, but `package.json` uses a caret range and no runtime version is
  documented.
- Add scheduled dependency review, lockfile update automation, and an SBOM once
  application dependencies exist. The current dependency tree is small and the
  live npm audit found zero advisories.
- Disable unused Supabase services in environments where they are not needed.
  Local Storage, S3 protocol, Realtime, Edge Runtime, analytics, and vector
  features are enabled by the generated config, although no KC3 feature uses
  them. This is low risk while local-only and unexposed.
- Select explicit columns and paginate client queries. `api.max_rows = 1000`
  limits row count, not per-row JSON/text size or total query cost.
- Validate stored URL schemes and present external navigation safely before the
  client opens `google_website` or `google_maps_url` values.
- Configure exact production auth redirect URLs and appropriate web security
  headers/origin behavior when hosting is selected. Treat CORS as a browser
  control, not authorization; database grants and RLS must protect the Data API
  regardless of request origin.
- Define sanitized user-facing errors and structured server logging before an
  app or import service exists. Logs must omit credentials, tokens, raw auth
  headers, and personal or full upstream payloads.
- Add rate limiting or abuse controls only to endpoints that become reachable.
  CAPTCHA is relevant if public auth is approved; write quotas are relevant if
  client writes are approved.

## Security Controls Already Implemented Well

- Every current application table has RLS enabled and no permissive policy.
- Current table grants and automatic Data API grants for future
  `postgres`-owned project objects are explicitly revoked in the migration;
  project access must be granted intentionally.
- The trigger helper sets an empty `search_path`, reducing object-shadowing risk,
  and client roles cannot execute it directly.
- PostgreSQL enums, foreign keys, uniqueness, check constraints, UUID primary
  keys, and transactional migrations provide useful integrity controls.
- Nullable unknown values are modeled explicitly rather than inventing facts.
- Refresh-token rotation is enabled; anonymous auth and manual account linking
  are disabled. Account signup is now also disabled until approved.
- Configuration examples refer to environment variables rather than containing
  secret values.
- `.env` files, dependencies, Supabase temporary state, signing keys, Expo/EAS
  local state, and common mobile credential formats are ignored.
- No credential-like file was present. Regex review of the current tree and Git
  patch history found only documentation/configuration variable names, not secret
  values.
- `package-lock.json` includes registry integrity hashes. `npm ls --all` completed
  successfully, and a live `npm audit` found zero known vulnerabilities in 15
  installed dependency entries.
- There is no client rendering, custom API, CORS customization, logging, or error
  path yet, so there is no present implementation of XSS, SQL injection, unsafe
  output rendering, or token storage to exploit. These areas must be reviewed
  when code is added rather than assumed safe permanently.

## Product Owner Decisions Required

### D-01 — Public data and authorization boundary

1. **Issue:** Which records, statuses, tables, and fields may unauthenticated or
   authenticated clients read is undefined.
2. **Risk:** A broad policy could expose hidden/internal/raw data; a narrow but
   incorrect policy could break the product.
3. **Likely options:** Direct read-only table access; a purpose-built read view or
   RPC; or a server/API layer that returns an approved projection.
4. **Tradeoffs:** Direct table reads are simple and fast but tightly couple the
   public contract to storage. A view/projection adds maintenance but reduces
   accidental column exposure. A server layer offers maximum control at greater
   cost and complexity.
5. **Recommendation (not approved):** Start with an explicitly enumerated,
   read-only public projection limited to approved fields and visible statuses;
   grant only `select`, keep all writes privileged, and add role/status/column
   tests in the same change.

### D-02 — Administrative curation and import path

1. **Issue:** KC3 has no approved way to create, update, refresh, or delete place
   data.
2. **Risk:** Putting a secret/service-role key in Expo would bypass RLS; one broad
   shared credential also increases blast radius and weakens auditability.
3. **Likely options:** Manual Dashboard/SQL curation; a trusted server or Edge
   Function; a CI/import job; or a dedicated limited database role/RPC.
4. **Tradeoffs:** Manual work is simplest but error-prone. Service-role automation
   is easy but highly privileged. A dedicated role/RPC takes more setup and has a
   smaller blast radius.
5. **Recommendation (not approved):** Keep every privileged credential in a
   server-controlled secret store and use a dedicated least-privilege import path
   with auditable operations. Never ship a secret/service-role key to clients.

### D-03 — Accounts and auth assurance

1. **Issue:** Accounts are not approved, while generated auth defaults are not a
   production security policy.
2. **Risk:** Enabling signup casually could create unverified/weak accounts and
   unclear authorization expectations.
3. **Likely options:** No MVP accounts; optional accounts with verified email; or
   required accounts with stronger authentication/MFA according to feature risk.
4. **Tradeoffs:** No accounts minimizes attack surface and privacy obligations.
   Accounts enable personalization but add recovery, abuse, deletion, session,
   and support requirements.
5. **Recommendation (not approved):** Keep signup disabled unless a confirmed
   feature requires identity. If approved, separately decide verification,
   password or passwordless flow, MFA, recovery, session lifetime, anti-abuse,
   account deletion, and authorization tests before launch.

### D-04 — Raw Google data and privacy lifecycle

1. **Issue:** The schema can retain full upstream JSON without a field allowlist,
   retention period, or public/private classification.
2. **Risk:** Unnecessary retention and accidental disclosure of upstream fields,
   plus oversized payload and provider-contract risk.
3. **Likely options:** Do not store raw payloads; retain them briefly for debugging
   in a non-exposed location; or retain long-term with access and deletion rules.
4. **Tradeoffs:** Raw data helps debugging/reprocessing but increases storage,
   privacy, licensing, and exposure risk. Minimized normalized data is safer but
   less flexible.
5. **Recommendation (not approved):** Store only fields KC3 needs. If raw payloads
   are temporarily necessary, keep them inaccessible to client roles, redact
   unnecessary content, set a retention limit, and never include them in a public
   projection.

### D-05 — Validation limits and hours semantics

1. **Issue:** Maximum text/JSON sizes, accepted URL schemes, overlapping hours,
   and equal open/close time meaning are undefined.
2. **Risk:** Data corruption, unsafe output navigation, excessive storage, and
   expensive API responses.
3. **Likely options:** Strict database constraints; application/import validation
   only; or layered validation with conservative database invariants.
4. **Tradeoffs:** Strict constraints protect every writer but can reject legitimate
   edge cases. Application-only rules evolve faster but can be bypassed by other
   writers.
5. **Recommendation (not approved):** Approve edge-case semantics after sampling
   real source data, then use layered validation: request/source validation plus
   database checks for stable invariants and explicit payload-size limits.

### D-06 — Production recovery and operator access

1. **Issue:** No hosting, backup tier, recovery objective, operator list, or
   production access process is approved.
2. **Risk:** Irrecoverable deletion, excessive admin access, compromised owner
   accounts, and insecure direct database exposure.
3. **Likely options:** Provider daily backups; paid point-in-time recovery; manual
   logical exports; open direct DB access; or restricted operator/network access.
4. **Tradeoffs:** Stronger recovery and network controls cost money and operating
   effort. Minimal controls are cheaper but accept more data loss and access risk.
5. **Recommendation (not approved):** Before launch, require MFA for repository
   and Supabase administrators, separate development and production, enforce SSL,
   restrict direct database access as narrowly as operations permit, document
   recovery objectives, and perform at least one restore test. Add PITR when the
   cost of losing changes since the last daily backup is unacceptable.

### D-07 — Google integration and external-service governance

1. **Issue:** No Google API integration, key restrictions, quotas, attribution,
   source allowlist, or failure behavior is approved.
2. **Risk:** API-key theft, quota/cost abuse, injection of malformed upstream data,
   provider-terms violations, and stale or misleading data.
3. **Likely options:** Manual seed data; server-side scheduled ingestion; or
   on-demand server-side refresh.
4. **Tradeoffs:** Manual data limits credentials and cost but becomes stale.
   Automation improves freshness while adding secrets, monitoring, quotas, and
   provider dependency.
5. **Recommendation (not approved):** If integration is approved, call Google
   only from trusted infrastructure, apply provider-supported API/application
   restrictions and budgets, validate/map fields through an allowlist, and define
   retry, staleness, attribution, and deletion behavior.

## Issues Fixed During This Task

1. Added ignore rules for environment loaders, Supabase auth signing keys, Expo/
   EAS local state, private keys, keystores, PKCS#12 files, and mobile provisioning
   profiles.
2. Disabled general and email signup to match the currently approved no-account
   product state.
3. Explicitly revoked current table privileges from `anon`, `authenticated`, and
   `service_role` so closed access does not depend only on RLS or project defaults.
4. Revoked direct execution of the public trigger function from Data API roles and
   PostgreSQL `PUBLIC`.
5. Revoked automatic table, sequence, and function grants for future
   `postgres`-owned project objects; future project API access now requires an
   intentional migration.
## Issues Intentionally Left Unchanged

- No RLS policy or API grant was added because public/authenticated behavior is
  not approved.
- No authentication system, role model, account table, MFA rule, or password
  policy was designed.
- No schema split, server layer, Edge Function, ingestion service, or admin UI was
  introduced.
- No text/JSON size cap, URL allowlist, overlapping-hours rule, or 24-hour-place
  interpretation was invented.
- No blank-text, Google rating/rating-count, or closed/next-day constraint was
  added because those data semantics require Product Owner confirmation.
- `raw_data` was not removed because the approved model includes it; its use and
  retention need a decision.
- Local Supabase services were not disabled because future approved development
  needs are unknown and they are not a production deployment.
- SSL/network/backup settings were not changed because there is no linked hosted
  environment or approved operator/deployment model.
- No CORS, output-escaping, SQL-query, token-storage, logging, or runtime error
  code was changed because none exists yet.

## Recommended Security Work, Prioritized

### Immediate MVP / before any client or production exposure

1. **Approve the public data boundary, then implement least-privilege grants, RLS,
   and pgTAP tests together.** This prevents unauthorized disclosure and write
   access. Do it before the first Expo/Supabase query.
2. **Approve and implement a server-controlled, least-privilege admin/import
   path.** This prevents a service-role or database credential from reaching a
   client and limits compromise blast radius. Do it before seed/import automation.
3. **Decide raw-data/privacy/retention rules.** This prevents unnecessary or
   accidental upstream-data disclosure. Do it before retaining Google payloads or
   collecting any user information.
4. **Establish production environment and recovery controls.** Separate dev/prod,
   keep secrets in platform stores, require admin MFA, enforce SSL, restrict
   direct DB access, verify Supabase Security Advisor findings, define backups,
   and test restore. This mitigates deployment compromise and unrecoverable loss;
   complete it before production.
5. **Define validation and safe-output contracts.** Enumerate returned columns,
   cap requests/payloads, validate import fields and URL schemes, paginate, and
   avoid rendering raw errors/upstream data. This mitigates injection-adjacent
   output risks, resource abuse, and data corruption; implement during the first
   client/import code.
6. **Add CI security gates.** Run secret scanning, `npm ci`, `npm audit`, migration
   reset/lint, and database authorization tests on pull requests. This prevents
   regressions and leaked credentials; add when CI/tooling is selected and no
   later than the first access-policy change.
7. **Keep signup disabled unless accounts are approved.** If they are approved,
   establish confirmation, password/passwordless, session, recovery, CAPTCHA,
   MFA, deletion, and authorization requirements first. This avoids premature
   account attack surface and privacy obligations.
8. **Create basic operational logging and sanitized errors.** Record import and
   privileged changes without secrets or full raw payloads; give users generic
   errors and keep diagnostic detail server-side. This supports incident response
   without leaking sensitive data; implement before beta/production workflows.

### Reasonable after the first bounded MVP, unless scope expands sooner

9. **Consider a dedicated API schema/read model.** It reduces accidental exposure
   as internal tables and functions multiply. Do it before the API becomes large
   or gains client writes; it is not necessary solely to review this migration.
10. **Add advanced abuse controls based on reachable features.** Rate limits,
    CAPTCHA, quotas, WAF rules, and stronger user MFA mitigate automated abuse,
    but should follow actual auth/write/search endpoints and expected traffic.
11. **Automate dependency maintenance and produce an SBOM.** This shortens
    vulnerability exposure and improves incident response. Add after application
    dependencies and deployment artifacts exist.
12. **Adopt stronger recovery/monitoring as data value grows.** PITR, alerting,
    anomaly detection, and formal incident runbooks reduce loss and response time.
    Add when curation volume or user-generated data makes daily-backup loss
    unacceptable.

## Files Changed

- `.gitignore`
- `supabase/config.toml`
- `supabase/migrations/20260821000000_initialize_kc3_mvp_schema.sql`
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/DEVELOPMENT.md`
- `docs/ROADMAP.md`
- `docs/SECURITY_REVIEW.md`
- `docs/DECISIONS.md`
- `package.json`
- `supabase/tests/001_schema_contract.test.sql`
- `supabase/tests/002_place_records.test.sql`
- `supabase/tests/003_place_hours.test.sql`
- `supabase/tests/004_timestamps_and_security.test.sql`

## Checks Performed and Results

**Reverified:** 2026-09-04

- Read all repository guidance and project documentation.
- Inventoried tracked, untracked, ignored, hidden, and symlink files. No unexpected
  tracked binary or symlink was found; `node_modules/` and `supabase/.temp/` are
  ignored.
- Reviewed the complete migration and active Supabase configuration.
- Searched current tracked content and all Git patch history with credential/key/
  connection-string patterns. No secret value was found; only documentation and
  environment-variable placeholders matched.
- Checked likely credential filenames. None existed.
- Ran `npm ls --all`: passed. Platform-specific unmet optional dependencies are
  expected; the matching macOS ARM64 CLI package is installed.
- Ran live `npm audit --json`: passed with zero known vulnerabilities (0 critical,
  high, moderate, low, or informational; 15 total dependency entries reported).
- Ran the repository-pinned Supabase CLI: `2.115.0`.
- Statically verified that every pgTAP file's declared plan equals its assertion
  count.
- Started the local Supabase stack and rebuilt the database from a clean reset;
  the KC3 migration applied successfully.
- Ran `npm test`: passed all 84 assertions across four pgTAP files.
- Ran `npm run lint:db`: passed with no schema errors.
- Ran `git diff --check`: passed.
- Verified all repository-local Markdown link targets: passed.

## External References Used

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Data API security](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Supabase platform security](https://supabase.com/docs/guides/security/platform-security)
- [Supabase database backups](https://supabase.com/docs/guides/platform/backups)
