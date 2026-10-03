# Overture Dry-run Reconciliation

Implemented 2026-10-03. This is planning and preservation verification for KC3-37,
not a publication, migration, matching, or retirement boundary. Spreadsheet
review and all existing launch gates remain open.

## Run

```sh
npm run plan:overture-reconciliation -- manifest.json places.csv hours.csv snapshot.json report.json
```

Use the original licensed manifest and the reviewed CSVs described in
[Overture Review](OVERTURE_REVIEW.md). The CLI runs the existing strict compiler:
Pending/Exclude rows are skipped, Ready identities need review/evidence, and
Ready hours need independently evidenced complete schedules. Invalid inputs
fail before report creation. The output is exclusively created and never
overwrites a previous report or input. There is no apply flag, credential
configuration, Supabase client, provider call, or database write.

Start with synthetic fixtures. This tool does not authorize exporting or
redistributing current Google-derived identity or historical content. Any real
snapshot requires the applicable access, source-use, and retention basis from
the KC3-37 plan. It does not export a database or certify snapshot completeness.

## Offline snapshot contract

The version-1 JSON snapshot contains `schemaVersion: 1` and `places`. Every place
has `id`, `updatedAt`, `identity`, `movedToPlaceId`, and `protected`.

- `identity`: `name`, `city`, `address`, `postcode`, `website`, `placeType`,
  `addressPrecision`, `latitude`, `longitude`, `timeZone`, and `status`.
  Optional postcode/website, coordinates, and timezone may be null. These are
  planning inputs, not an expansion of the anonymous public projection.
- `protected`: explicit arrays for `details`, `kc3Hours`, `overrides`, and
  `correctionEvidence`, including empty arrays. Retain exact row values,
  timestamps, nulls, verified negatives, and evidence snapshots. Only KC3-owned
  schedules belong in `kc3Hours`, and their `source` must be `kc3`.
- IDs must be unique, dates parseable, and move links must refer to another
  snapshot place. Supply the full intended target inventory rather than only
  spreadsheet matches. Unknown or duplicate explicit targets become conflicts.

The caller is responsible for a complete, consistent, permitted snapshot.
The CLI does not infer absent rows, source rights, or authoritative municipal
boundaries from postal locality.

## Report semantics

Only an explicit reviewed `targetPlaceId` matches an existing KC3 ID. Names,
addresses, and proximity never establish a match. Unmapped rows are new
candidates requiring duplicate and identity review; the planner allocates no
IDs. All participants in duplicate target mappings are blocked.

The report contains proposed independent identity values, changed field names,
identity evidence, source licenses, expected target `updatedAt`, and hashes of
protected values/reviewed schedules. It does not reproduce previous canonical
values or protected detail, override, or correction-history rows. Existing
hidden decisions, city changes, moved-place relationships, and conflicting KC3
hours block a candidate. Missing reviewed hours mean preserve existing hours or
remain unknown, never clear a schedule or assume closed.

Unmatched current IDs are reported as untouched, never hidden or deleted. Every
report has `publicationAllowed: false` and lists outstanding municipal
eligibility, identity/duplicate review, publication provenance, and Google
history/secondary-copy retirement work. A conflict-free candidate does not
establish launch eligibility or approve future mutation.

## Exact preservation verification

`verifyProtectedReconciliation(before, after)` returns existing KC3 IDs whose
protected values changed or disappeared. It compares exact details, KC3-owned
hours, overrides, correction evidence, city, hidden status, and move links.
Object-key order and database row order do not change equality; values, row
multiplicity, nested arrays, nulls, booleans, and timestamps do. New places are
permitted in the after snapshot, but existing IDs cannot disappear.

Use this helper in a later disposable cutover rehearsal. It verifies supplied
snapshots, not an executed migration. Canonical correction/history retirement
policy and the actual cutover still need their own reviewed implementation.
