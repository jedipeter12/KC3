# Roadmap

This file tracks project state. It should describe what is finished, what is being worked on, and what is likely next.

## Current Objective

Review the initial MVP seed data while defining the remaining bounded KC3 client
MVP before application scaffolding.

## In Progress

- [ ] Product Owner review of candidate MVP features and open product questions in
  `PRODUCT.md`.
- [ ] Product Owner review of the transactional, idempotent local MVP seed.

## Next

- [ ] Convert the approved MVP into prioritized, small, reviewable implementation
  tickets with acceptance criteria.
- [ ] Define least-privilege RLS policies before exposing place data to clients.
- [ ] Approve the public data/column/status boundary and add grant/RLS regression
  tests in the same change as the first client access.
- [ ] Approve a server-controlled, least-privilege administrative import and
  curation path; never expose privileged Supabase credentials to a client.
- [ ] Decide raw Google payload retention/privacy rules before ingestion.
- [ ] Define the Google import workflow and any later curated seed expansion.
- [ ] Scaffold the Expo/TypeScript application and record the resulting setup,
  commands, and repository structure.
- [ ] Select and document application testing, linting, formatting, hosting, and
  release tooling during application scaffolding.
- [ ] Add the database test and lint commands to CI after CI is selected.

## Later

- [ ] Evaluate post-MVP product ideas only after the first MVP boundary is
  approved.
- [ ] Consider a separate web frontend only if requirements such as public search
  discoverability justify it.
- [ ] Consider more autonomous delivery orchestration after the supervised
  workflow is proven and repeatable.

## Completed

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
- [x] Transactional, rerunnable local MVP seed added with 15 representative
  Lenexa, Overland Park, and Olathe places and seed-specific regression coverage.

## Deferred / Rejected

Use this section for ideas intentionally postponed or rejected so they are not repeatedly rediscovered.

- Lyfe project implementation is parked while KC3 establishes the initial
  product-to-deployment workflow.
- User accounts, user submissions, freshness reports, "I'm working here" status,
  notifications, community/social features, complex moderation, and real-time
  occupancy are not approved MVP work. They remain tentative future ideas.
- Autonomous multi-agent orchestration is not required for the initial workflow.

## Known Bugs / Issues

- No application exists yet, so there are no runtime bugs to track.
