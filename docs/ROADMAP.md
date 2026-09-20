# Roadmap

This file tracks project state. It should describe what is finished, what is being worked on, and what is likely next.

## Current Objective

Use the completed and verified manual Google Places ingestion boundary to
construct the reviewed Johnson County dataset.

## In Progress

- [ ] KC3-23: Final automated verification and live Expo Web smoke pass complete;
  milestone closure remains blocked by KC3-21 and the live mobile smoke check.
  See `docs/MVP_VERIFICATION.md` for evidence and closeout requirements.
- [ ] KC3-21: Web keyboard/responsive checks and accessibility fixes verified;
  native interactions, large text, and spoken screen-reader checks remain open.

## Next

- [ ] KC3-27: Construct the real Johnson County dataset through the reviewed
  operator workflow.
- [ ] Keep unrestricted raw Google payload retention disabled; require a new
  privacy/licensing/access decision before adding it later.
- [ ] Define the Google import workflow and any later curated seed expansion.
- [ ] Select hosting and release tooling when deployment work is approved.

## Later

- [ ] Evaluate post-MVP product ideas only after the first MVP boundary is
  approved.
- [ ] Consider a separate web frontend only if requirements such as public search
  discoverability justify it.
- [ ] Consider more autonomous delivery orchestration after the supervised
  workflow is proven and repeatable.

## Completed

- [x] KC3-26 verifies the KC3-24/KC3-25 Google-owned persistence path for
  ordinary, closed, split, overnight, unchanged, changed, missing, and failed
  weekly-hours refreshes; distinguishes provider freshness from KC3 verification;
  and confirms the existing schema and atomic importer require no expansion.
- [x] KC3-25 adds a bounded, dry-run-first Google Places CLI; exact KC3-24 field
  masks and normalization; continuation handling; stable identity refreshes; a
  constrained transactional server-only write boundary; ownership-preserving
  database behavior; sanitized summaries; offline provider/error tests; and
  documented operator usage without client credentials or live CI calls.
- [x] Google Places ingestion contract defines the exact MVP field mask, source
  ownership, deterministic comparisons, duplicate/new/move/closure semantics,
  regular-hours normalization, non-destructive overrides, timestamps, and atomic
  refresh behavior; supporting schema and fixtures added without an importer or
  API calls (KC3-24).
- [x] GitHub Actions CI installs locked dependencies, checks application quality
  and all Expo exports, and verifies local Supabase reset, pgTAP, database lint,
  and live RPC tests without production credentials. Hosted passing and
  intentional-failure runs verified; temporary probe removed (KC3-22).
- [x] Live client-to-RPC smoke suite verifies all 15 seeded places, exact raw
  five-field serialization, production data-layer results, and explicit anonymous
  base-table denial; local prerequisites and failure guidance documented (KC3-20).
- [x] Repository initialized
- [x] Initial working stack approved: TypeScript, React Native/Expo, Expo Web, and
  Supabase/PostgreSQL.
- [x] Repository-centered roles and supervised delivery workflow documented.
- [x] Documentation gap analysis completed against the 2026-08-19 conversation
  context.
- [x] MVP place data model approved.
- [x] Initial Supabase migration authored with RLS enabled and no permissive
  policies.
- [x] Defensive repository security review completed; deny-by-default grants,
  signup closure, and credential ignore rules added.
- [x] pgTAP regression coverage and PostgreSQL lint commands added for the
  approved MVP data model.
- [x] Initial Supabase schema hardened, tested, approved, and merged.
- [x] Transactional, rerunnable local MVP seed added, reviewed, and merged with 15
  representative Lenexa, Overland Park, and Olathe places and seed-specific
  regression coverage.
- [x] Anonymous public place boundary approved and implemented as a read-only RPC
  limited to active place IDs, names, cities, addresses, and place types, with
  dedicated-role, RLS, privilege, status, column, and write-denial tests.
- [x] List-first Expo MVP approved with an anonymous place list, client-side name
  search and city/place-type filters, loading/empty/error states, and no map,
  accounts, writes, hours, or place-detail screen.
- [x] Prioritized implementation and historical tickets captured in the KC3
  Notion tracker while retaining this roadmap as the source of truth.
- [x] Expo SDK 57 TypeScript application scaffolded with a documented `src/` and
  `tests/` structure, Node/npm pinning, Jest, ESLint, Prettier, strict typechecking,
  and verified Web/iOS/Android export commands.
- [x] Expo-safe public Supabase client configured with documented public
  environment variables, sanitized validation, an exact five-field RPC type,
  focused unit coverage, and no privileged client credentials (KC3-15).
- [x] Typed public-place data layer implemented over `list_public_places()` with
  ordered exact-field results, explicit empty behavior, sanitized application
  errors, and focused client-level tests (KC3-16).
- [x] Responsive public place-list screen implemented with ordered four-field
  rows, human-readable place types, explicit loading and empty states, sanitized
  error recovery, retry behavior, and focused component coverage (KC3-17).
- [x] Client-side place-name search and derived city/place-type filters
  implemented with AND behavior, local clearing, a distinct no-match state, no
  additional database calls, and focused unit and interaction coverage (KC3-18).
- [x] List-first automated UI coverage verified and strengthened for successful
  mixed-case search, independent combined filters and resets, selected controls,
  and exclusion of IDs and unapproved runtime fields (KC3-19).

## Deferred / Rejected

Use this section for ideas intentionally postponed or rejected so they are not repeatedly rediscovered.

- Lyfe project implementation is parked while KC3 establishes the initial
  product-to-deployment workflow.
- User accounts, user submissions, freshness reports, "I'm working here" status,
  notifications, community/social features, complex moderation, and real-time
  occupancy are not approved MVP work. They remain tentative future ideas.
- Autonomous multi-agent orchestration is not required for the initial workflow.

## Known Bugs / Issues

- Native verification is incomplete: the iOS simulator launches KC3, but UI
  automation cannot tap its content (initially `AXError.cannotComplete`; the
  follow-up returned `noWindowsAvailable`, including after reconnecting).
  Android tooling is unavailable. See `docs/ACCESSIBILITY_REVIEW.md` for evidence
  and the manual completion procedure.
