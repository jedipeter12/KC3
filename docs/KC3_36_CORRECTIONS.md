# KC3-36 Canonical Correction Record

**Run date:** 2026-10-01

**Target:** Disposable local Supabase database

**Scope:** Reviewed provider-backed park anomalies from KC3-33

## Dataset preparation

The clean 15-place seed contained no provider identities, so the operator first
ran the documented dry-run/write sequence for the minimum relevant categories:

- Lenexa parks: 40 discovered, 34 inserted, 6 outside-city skips, 0 failures.
- Olathe parks: 44 discovered, 39 inserted, 5 outside-city skips, 0 failures.

Both searches reached a natural provider end without provider or selection
capping. This was a targeted local correction dataset, not a reconstruction of
the full 18-query MVP dataset.

## Applied corrections

Each change was made with `npm run edit:place-canonical`, reviewed at the CLI
before exact `yes` confirmation, and committed with one immutable
`place_canonical_corrections` evidence row. Provider values in
`place_google_data` remained unchanged.

### Kickapoo Park

- Google Place ID: `ChIJhxt1cZGUwIcRCW-ZOpSUDvA`
- Canonical name: `Kickapoo Park RIGHT` → `Kickapoo Park`
- Canonical address: `W 93rd St & Greenway Ln, Lenexa, KS 66215, USA` →
  `14534 W. 93rd St., Lenexa, KS 66215`
- Address precision: `approximate` → `street_address`
- Place type retained: `park`
- Evidence: [City of Lenexa — Kickapoo Park](https://www.lenexa.com/Parks-Places/Parks-Outdoors/Parks/Kickapoo-Park)

### Heritage Forest Park

- Google Place ID: `ChIJO4peO1mTwIcRygQ-DyX6z6w`
- Canonical name retained: `Heritage Forest Park`
- Canonical address: `F fTy W v. Pflumm Rd &, W 83rd St, Lenexa, KS 66215, USA`
  → `W. 83rd Street west of Pflumm Road, Lenexa, KS 66215`
- Address precision retained: `approximate`; no street number was inferred.
- Place type retained: `park`
- Evidence: [City of Lenexa — Heritage Forest Park](https://www.lenexa.com/Parks-Places/Parks-Outdoors/Parks/Heritage-Forest-Park)

### Raven Ridge Park

- Google Place ID: `ChIJ1yEEEBqWwIcRQtmtG3J6lYc`
- Canonical name retained: `Raven Ridge Park`
- Canonical address: `&, W Harold St & N Iowa St, Olathe, KS 66061, USA` →
  `675 W. Harold St., Olathe, KS 66061`
- Address precision: `approximate` → `street_address`
- Place type retained: `park`
- Evidence: [City of Olathe — Raven Ridge Park](https://www.olatheks.gov/government/parks-recreation/parks-trails-bike-lanes/raven-ridge-park)

The post-write database check returned these exact canonical values, retained
the original Google name/address values, and counted exactly three correction
evidence rows.

## Production-path issue found and fixed

The first Kickapoo write was safely rejected before any change or evidence row
was stored. Supabase returned the place `updated_at` version as ISO 8601, while
the database function compared it to PostgreSQL's text rendering. Migration
`20261001000000_accept_api_canonical_correction_version.sql` now validates and
normalizes the API timestamp before the existing exact concurrency check. The
database regression fixture uses an API-shaped timestamp, and all three real CLI
writes subsequently succeeded.

## Deliberately unresolved

- The area-only Boba Tea record was not changed. Available evidence still does
  not establish the exact physical identity and address strongly enough for a
  canonical correction.
- `Hermetheus Downtown Olathe Library` remains a `cafe`. Its legitimate
  located-inside relationship and separate hours belong to the future explicit
  place-relationship model, not a canonical classification correction.

## Verification

Against the corrected local dataset:

- 296 pgTAP assertions passed across 13 files.
- 92 application tests and six local HTTP integration tests passed.
- TypeScript, ESLint, Prettier, PostgreSQL lint, and whitespace checks passed.
- No public/client privilege was added, and the three corrections are local data
  only; no hosted or production database was modified.
