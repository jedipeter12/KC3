# KC3-28 Refresh and Integration Verification

## Status

Locally complete on 2026-09-20 against a clean Supabase reset and live Google
Places data; hosted CI and Product Owner review remain pending. The bounded
import is repeatable and ownership-safe, the anonymous
five-field RPC and production filters work at 164-record volume, and one
unchanged-hours comparison defect found by the live rerun was corrected and
reverified.

This is the current local dataset snapshot. `KC3_27_DATASET.md` remains the
historical construction record for the earlier 162-place snapshot.

## Bounds and operator procedure

The run retained KC3-27's fixed scope:

- Cities: Lenexa, Overland Park, and Olathe.
- Categories: `coffee_shop`, `cafe`, `boba_tea`, `library`, `coworking`, and
  `park`.
- Search: one page per city/category except Lenexa park, which allowed three
  pages and ended after two; each city command allowed 200 selected identities.
- Target: disposable local Supabase only.
- Fields: the unchanged allowlist in `GOOGLE_INGESTION_CONTRACT.md`.

The database was reset first, followed by 190 passing pgTAP assertions, database
lint, and the four-test clean-seed anonymous HTTP smoke. The four live commands
were dry-run before write. All 14 KC3-27 mappings were reviewed again. The
Lenexa park result now included Sar-Ko-Par Trails Park, so its provider identity
was also reviewed and attached to stable seed UUID
`6b633300-0000-4000-8000-000000000005` rather than creating a duplicate. The
reviewed Google Place ID is `ChIJWwHgcJyUwIcR1SmQRUlTMCc`; review its live
name/address again before reusing the mapping.

For future refreshes, follow `docs/DEVELOPMENT.md`, review every live mapping,
save the aggregate output, and run `supabase/audits/kc3_28_refresh.sql` after the
initial write and immediate repeat. Search rankings are live inputs; identical
bounds do not promise identical discovered IDs.

## Live import evidence

### Initial write

| Invocation | Discovered | Inserted | Updated | Skipped | Failed |
| --- | ---: | ---: | ---: | ---: | ---: |
| Lenexa non-park categories | 53 | 18 | 3 | 32 | 0 |
| Lenexa park | 34 | 30 | 2 | 2 | 0 |
| Overland Park | 97 | 62 | 5 | 30 | 0 |
| Olathe | 79 | 39 | 5 | 35 | 0 |
| **Total** | **263** | **149** | **15** | **99** | **0** |

The resulting dataset contained 164 canonical places, 164 unique provider
identities/provider rows, and 1,118 Google hour rows across 159 places. There
were no normalized name/address duplicates, duplicate Google-hour rows, source
identity mismatches, invalid source timestamp orderings, or non-active rows.

### Immediate repeat

| Invocation | Discovered | Inserted | Updated | Skipped | Failed |
| --- | ---: | ---: | ---: | ---: | ---: |
| Lenexa non-park categories | 53 | 0 | 21 | 32 | 0 |
| Lenexa park | 34 | 0 | 32 | 2 | 0 |
| Overland Park | 97 | 0 | 67 | 30 | 0 |
| Olathe | 78 | 0 | 44 | 34 | 0 |
| **Total** | **262** | **0** | **164** | **98** | **0** |

Canonical, provider-row, and Google-hour counts stayed exactly 164, 164, and
1,118. The repeat therefore created no canonical, provider, or hour duplicate.
Provider fetch timestamps advanced from an initial range of
`2026-09-20 19:59:32.803+00`–`20:01:06.204+00` to
`20:02:40.278+00`–`20:11:53.794+00`.

The timestamp audit exposed that all 159 schedules had also been rewritten.
The planner used JSON serialization for equality, while PostgreSQL JSONB
returned the same hour fields in a different object-key order. The field values
were equal but the serialized strings were not. KC3-28 replaced that comparison
with sorted field-by-field equality and added a database-key-order regression
fixture.

### Corrected repeat

The same bounds were run again with the fix. Live ranking returned 259 identities
this time: zero inserted, 163 updated, 96 skipped, and zero failed. Counts
remained 164 canonical places, 164 provider rows, and 1,118 Google-hour rows.
For 158 of the 159 stored schedules, `google_fetched_at` advanced while
`source_observed_at` remained older, proving unchanged schedules were preserved.
One schedule stayed equal to its prior provider fetch because one existing
provider-backed record was omitted by this ranked search and was not refreshed.

## Final dataset snapshot

| City | Coffee | Cafe | Boba/tea | Library | Coworking | Park | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Lenexa | 7 | 9 | 2 | 1 | 2 | 32 | 53 |
| Overland Park | 18 | 7 | 9 | 4 | 13 | 16 | 67 |
| Olathe | 9 | 10 | 2 | 5 | 0 | 18 | 44 |
| **Total** | **34** | **26** | **13** | **10** | **15** | **66** | **164** |

All 164 places are provider-backed and active. All 15 representative seed UUIDs
are reconciled. Five provider responses have no regular schedule, so their hours
remain unknown.

## Ownership, refresh, and failure evidence

Before the live import, Black Dog Coffeehouse received a controlled KC3 detail
fixture covering notes, classifications, nullable booleans, and
`last_verified_at = 2026-09-20`. Exact before/after reads proved every value and
the KC3 verification date survived the initial import and repeats while its
provider fetch timestamp advanced. The fixture was then removed so the final
local dataset again satisfies the reviewed 15 unknown-detail-shell seed
invariant.

Automated fixtures and real database transactions additionally verify:

- changed Google name/rating/hour values update only their approved provider,
  canonical-presentation, and Google-hour targets;
- omitted values and hours preserve stored values, while a successful response
  still advances provider freshness;
- temporary closure preserves the normal schedule, permanent closure produces
  the explicit closed schedule, and Google never replaces a KC3-hidden state;
- incomplete and malformed records are skipped or rejected before mutation;
- interrupted search/detail calls and database failures are sanitized and do not
  partially write or advance freshness; and
- failed normalized writes roll back provider metadata and hour replacement.

The importer role still cannot mutate KC3 details, overrides, or KC3-owned hour
rows. No schema, field mask, public API, or privilege expansion was needed.

## Anonymous client and UI evidence

The real-dataset HTTP suite requires more than 100 rows when
`KC3_EXPECT_PROVIDER_DATASET=1`, verifies exactly the approved five serialized
fields, exercises the production data layer, applies mixed-case name search and
combined Olathe/park filters, checks all three cities and six types, and proves
direct anonymous base-table access still fails with PostgreSQL `42501`.

Expo Web loaded all 164 active places from `list_public_places()`. Search for
`bLaCk DoG` returned Black Dog Coffeehouse, Olathe plus park showed only Olathe
parks, clearing restored the full list, and the browser console had no warnings
or errors.

Expo launched and bundled successfully in Expo Go on the iPhone 17 simulator.
The macOS Device Hub again timed out when exposed to UI automation, so native
interaction was not claimed as a KC3-28 pass. The three-platform production
export passed; this limitation remains with the deferred KC3-21 native
accessibility work.

## Findings and follow-up

No functional list-first or authorization defect remained after the hours
comparison fix. Live data did expose suspicious provider presentation and
classification examples, including `Kickapoo Park RIGHT`, a malformed-looking
Heritage Forest Park address, leading punctuation in the Raven Ridge Park
address, a city-only Boba Tea address, and a library café discovered as `cafe`.
The 164-row unfiltered list also deserves deliberate usability review.

KC3-29 is the explicit follow-up to review provider presentation quality,
ambiguous sub-place/category records, and list scalability before broader UI/UX
refinement. KC3-28 does not silently correct provider facts or redesign the UI.

## Verification summary

- Clean reset and real-dataset pgTAP: 190 assertions passed.
- Application/importer/component tests: 66 passed.
- Clean and real-dataset anonymous HTTP integration: 4 passed in each state.
- Typecheck, ESLint, Prettier, PostgreSQL lint, and `git diff --check`: passed.
- Expo Web, iOS, and Android export: passed.
- Generated artifacts contained no configured Google key, server-only variable
  name, or Google Places endpoint.
- Hosted GitHub Actions: pending the branch push/PR; no local check substitutes
  for the configured hosted run.

## Known limitations

The data remains a bounded, ranked provider sample rather than an exhaustive
directory. Provider ranking varied even between adjacent runs, nine one-page
queries remained provider-capped, malformed/unrepresentable hours are skipped,
and missing schedules remain unknown. A bounded search rerun can omit a stored
identity or discover a new valid identity without violating stable-ID
idempotency; operators must interpret discovery counts together with the
duplicate and source audits.
