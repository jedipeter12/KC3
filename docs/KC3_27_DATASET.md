# KC3-27 MVP Dataset Run Record

> Historical snapshot: KC3-28 later repeat-verified and refreshed this dataset
> to 164 canonical/provider-backed places and reconciled Sar-Ko-Par Trails Park.
> See `KC3_28_VERIFICATION.md` for the current local run record.

## Status

Completed locally on 2026-09-20. The bounded billable discovery attempted all 18
approved city/category combinations, imported 161 provider-backed places through
the server-only ingestion boundary, reconciled 14 representative seeds, and
completed the post-import audit and public application smoke checks on Web and
the iOS Simulator.

## Fixed bounds

- Cities: Lenexa, Overland Park, Olathe.
- KC3 categories: `coffee_shop`, `cafe`, `boba_tea`, `library`, `coworking`,
  `park`.
- Search bound: one 20-result Google Text Search page per category except Lenexa
  park, which was extended to the allowed three-page bound to look for an
  unreconciled seed and ended naturally after two pages. Each city invocation
  allowed at most 200 selected unique places.
- Detail fields: the exact mask in `GOOGLE_INGESTION_CONTRACT.md`.
- Target: local Supabase only unless a later run explicitly records another
  authorized target.

## Query coverage

`Provider capped` means a continuation remained after the configured page bound;
those queries are non-exhaustive. No query hit the 200-place selection cap.

| City | Category | IDs | Pages | Provider capped | Selection capped |
| --- | --- | ---: | ---: | --- | --- |
| Lenexa | coffee_shop | 20 | 1 | Yes | No |
| Lenexa | cafe | 20 | 1 | Yes | No |
| Lenexa | boba_tea | 12 | 1 | No | No |
| Lenexa | library | 1 | 1 | No | No |
| Lenexa | coworking | 5 | 1 | No | No |
| Lenexa | park | 34 | 2 | No | No |
| Overland Park | coffee_shop | 20 | 1 | Yes | No |
| Overland Park | cafe | 20 | 1 | Yes | No |
| Overland Park | boba_tea | 13 | 1 | No | No |
| Overland Park | library | 18 | 1 | No | No |
| Overland Park | coworking | 20 | 1 | Yes | No |
| Overland Park | park | 20 | 1 | Yes | No |
| Olathe | coffee_shop | 20 | 1 | Yes | No |
| Olathe | cafe | 20 | 1 | Yes | No |
| Olathe | boba_tea | 6 | 1 | No | No |
| Olathe | library | 11 | 1 | No | No |
| Olathe | coworking | 5 | 1 | No | No |
| Olathe | park | 20 | 1 | Yes | No |

Across the four final write commands, discovery selected 254 records: 147 were
inserted, 14 updated reviewed seed identities, 92 were rejected as out of the
requested city, one was rejected for unrepresentable regular hours, and none
failed. The invalid record was `Little Free Library`
(`ChIJQfN5LgDBwIcRwzem-QdW5Ys`): its Friday period closes on Monday, which the
approved same-day/next-day schedule model cannot represent. No moved or closed
listing was returned in the selected set.

### Stored counts by city and KC3 category

| City | coffee_shop | cafe | boba_tea | library | coworking | park | Total | Provider-backed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Lenexa | 7 | 9 | 2 | 1 | 2 | 33 | 54 | 53 |
| Overland Park | 18 | 5 | 9 | 4 | 13 | 16 | 65 | 65 |
| Olathe | 8 | 10 | 2 | 5 | 0 | 18 | 43 | 43 |
| **Total** | **33** | **24** | **13** | **10** | **15** | **67** | **162** | **161** |

### Reviewed seed attachments

These mappings record the 2026-09-20 reconciliation decisions. On refresh,
confirm the returned name/address still identifies the same physical place before
reusing a mapping.

| KC3 place | KC3 UUID | Google Place ID |
| --- | --- | --- |
| Lenexa City Center Library | `6b633300-0000-4000-8000-000000000001` | `ChIJYZvmEq6VwIcRfjP8C-JhBH0` |
| Black Dog Coffeehouse | `6b633300-0000-4000-8000-000000000002` | `ChIJW4FqNKmUwIcRDtDZHMN3rV8` |
| Maps Coffee & Chocolate | `6b633300-0000-4000-8000-000000000003` | `ChIJuRqhv7uUwIcR3_Awkka3Hb0` |
| Black Hoof Park | `6b633300-0000-4000-8000-000000000004` | `ChIJD5faIc6WwIcRiPwuG7i8XTg` |
| Blue Valley Library | `6b633300-0000-4000-8000-000000000006` | `ChIJYaBsIlTAwIcRn3f6OG_zeDE` |
| Central Resource Library | `6b633300-0000-4000-8000-000000000007` | `ChIJ28bnX2TrwIcRynpha9deuhI` |
| Oak Park Library | `6b633300-0000-4000-8000-000000000008` | `ChIJh9xKXkPrwIcRBqeqx-JHkAQ` |
| Homer's Coffee House | `6b633300-0000-4000-8000-000000000009` | `ChIJRXgPnnPswIcRmazRKA8qZDA` |
| Pilgrim Coffee Company | `6b633300-0000-4000-8000-000000000010` | `ChIJIWWZr3TqwIcRcjRHMu3NTQM` |
| Olathe Downtown Library | `6b633300-0000-4000-8000-000000000011` | `ChIJ4ztW3169wIcRnIen1w-CqdA` |
| Olathe Indian Creek Library | `6b633300-0000-4000-8000-000000000012` | `ChIJ-9iminyVwIcRkHcP0PR_glM` |
| Sweet Tee's Coffee Shop | `6b633300-0000-4000-8000-000000000013` | `ChIJtUFf_iS-wIcRpy1qcjzSuxo` |
| Apogee Coffee & Draft | `6b633300-0000-4000-8000-000000000014` | `ChIJKZGnq1SVwIcRWD1SVhjpehU` |
| Black Bob Park | `6b633300-0000-4000-8000-000000000015` | `ChIJFTqNmKS_wIcRhgoMG4_Nqlc` |

## Reconciliation and audit evidence

- Total unique canonical places: 162; all 162 are active and load through the
  active-only public RPC.
- Provider-backed places: 161; all have a stable Google identity, provider fetch
  timestamp, and matching provider row.
- Representative seed places reconciled: 14 of 15. `Sar-Ko-Par Trails Park`
  remains the single seed-only record because the uncapped 34-result Lenexa park
  query did not return it. No second canonical Sar-Ko-Par record was imported.
- Places with Google weekly hours: 156; five provider responses omitted regular
  hours, so those schedules correctly remain unknown. Stored Google hour rows:
  1,097, all with source observation timestamps.
- All 161 provider-backed records returned `OPERATIONAL`; no closure transition
  was required in this run.
- Exact normalized name/address duplicates: zero. Ten pairs within 100 meters
  were reviewed and are distinct businesses, facilities, tenants, or features,
  including the Lenexa Public Market tenants, the café at Olathe Downtown
  Library, and the playground at Indian Creek Library.
- Out-of-area or unsupported stored records, missing source/fetch metadata,
  malformed stored hours, and unverified KC3 detail claims: zero.
- Every representative detail shell remains `unknown`/null with no
  `last_verified_at`; provider ingestion fabricated no KC3 suitability value.

### Spot checks

Record at least one place from each city. Compare the canonical row, allowlisted
Google row, Google-source hours, and KC3 detail row without copying unrestricted
provider responses into this document.

| City | KC3 place | Canonical/provider identity | Hours/source metadata | KC3 details | Result |
| --- | --- | --- | --- | --- | --- |
| Lenexa | Lenexa City Center Library | Stable seed UUID retained; Google identity attached; canonical name/address preserved while provider presentation is stored separately | 7 Google rows with matching observation metadata | All classifications unknown; unverified | Pass |
| Overland Park | Central Resource Library | Stable seed UUID retained; Google identity attached; canonical name/address preserved while provider presentation is stored separately | 7 Google rows with matching observation metadata | All classifications unknown; unverified | Pass |
| Olathe | Olathe Downtown Library | Stable seed UUID retained; Google identity attached; canonical name/address preserved while provider presentation is stored separately | 7 Google rows with matching observation metadata | All classifications unknown; unverified | Pass |

## Verification

- Clean-reset pgTAP/import boundary: 188 assertions passed on 2026-09-20.
- PostgreSQL lint: no warnings on 2026-09-20.
- Application unit/component/importer tests: 60 tests passed on 2026-09-20.
- Clean-seed anonymous RPC smoke: 3 tests passed on 2026-09-20.
- Real-dataset pgTAP: 188 assertions passed on 2026-09-20.
- Real-dataset anonymous RPC smoke: 3 tests passed on 2026-09-20.
- Expo Web smoke: Passed on 2026-09-20. The app loaded all active data through
  `list_public_places()`; name search returned Black Dog Coffeehouse, and combined
  Olathe + park filtering returned only Olathe parks.
- Expo Web/iOS/Android export: Passed. A generated-artifact scan confirmed the
  server-only Google key value was not embedded.
- Live native mobile smoke: Passed manually on 2026-09-20 using the iPhone 17
  simulator on iOS 26.5. The app loaded the real local dataset through
  `list_public_places()`; name search returned Black Dog Coffeehouse, combined
  Olathe + park filtering returned only Olathe parks, and clearing filters
  restored the full list. Automated native accessibility interaction remains a
  separately tracked gap.

## Coverage statement

This dataset must be described as a bounded provider sample, not an exhaustive
directory. Google Text Search ranking, strict type assignment, per-query page
limits, provider omissions, city-component filtering, and skipped malformed,
moved, out-of-area, or unresolved records can all create coverage gaps. Nine
queries retained a provider continuation after the one-page bound. Sar-Ko-Par
was absent even from its uncapped category query, five schedules were omitted by
the provider, and one multi-day schedule was rejected. The dataset is therefore
production-like for MVP review but is not an exhaustive directory.
