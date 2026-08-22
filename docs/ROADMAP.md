# Roadmap

This file tracks project state. It should describe what is finished, what is being worked on, and what is likely next.

## Current Objective

Review the approved MVP data-model migration while defining the remaining bounded
KC3 client MVP before application scaffolding.

## In Progress

- [ ] Product Owner review of candidate MVP features and open product questions in
  `PRODUCT.md`.
- [ ] Product Owner review and merge of the initial Supabase schema migration.

## Next

- [ ] Convert the approved MVP into prioritized, small, reviewable implementation
  tickets with acceptance criteria.
- [ ] Define least-privilege RLS policies before exposing place data to clients.
- [ ] Define the Google import and curated seed-data workflows.
- [ ] Scaffold the Expo/TypeScript application and record the resulting setup,
  commands, and repository structure.
- [ ] Select and document testing, linting, formatting, hosting, and release
  tooling.

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
