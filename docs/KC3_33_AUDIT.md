# KC3-33 Real MVP Dataset Audit

**Status:** Completed

**Audit date:** 2026-09-24

**Scope:** Bounded, non-release-blocking audit of the delivered KC3-31 place
list, detail, and discovery experience against a fresh real MVP dataset.

## Dataset Exercised

The audit repeated the approved dry-run-first importer across all 18 MVP
city/category combinations and applied the reviewed seed attachments to the
disposable local Supabase database. The resulting active public dataset contains
160 canonical, provider-backed places. All 15 representative seed identities
remain reconciled.

This is a fresh bounded provider result, not a claim that Google returns a fixed
or exhaustive snapshot. The prior verified run contained 164 records; current
ranking and discovery variability account for the difference.

| City | Coffee shop | Cafe | Boba/tea | Library | Coworking | Park | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Lenexa | 10 | 5 | 2 | 1 | 2 | 32 | 52 |
| Overland Park | 18 | 5 | 9 | 4 | 13 | 16 | 65 |
| Olathe | 10 | 9 | 2 | 6 | 0 | 16 | 43 |
| **Total** | **38** | **19** | **13** | **11** | **15** | **64** | **160** |

The audited data included:

- 1,090 normalized weekly-hours rows for 155 places and five intentional
  unavailable-schedule states;
- 25 approximate addresses and no unknown address-precision records;
- 160 explicitly unverified KC3 detail records, with no unsupported suitability
  claim;
- names up to 53 characters and addresses up to 84 characters;
- 10 places containing a 24-hour day, four with an overnight interval, and 38
  with at least one explicitly closed day.

The live integration suite fetched every active summary and all 160 matching
details. For every record it exercised normalized exact-name discovery,
city/type discovery, hours status, all seven formatted schedule days when hours
were available, the empty schedule contract when they were not, and the external
map URL builder.

## Issues Resolved

The audit found and fixed six bounded experience problems:

1. Browser Back restored the list query but could leave focus at the document
   root. A history pop now marks restoration pending so scroll and focus return
   to the originating card.
2. The narrow Web filter dialog initially left focus behind the modal. Opening
   the surface now moves focus to Close; Escape still closes it and returns focus
   to Filters. Native accessibility focus uses the same entry target.
3. Filter options inherited provider result order, which made city and place-type
   controls jump between runs. Present choices now follow the approved MVP city
   and type order while omitting choices absent from the loaded result.
4. Visually distinct same-name locations used their addresses, but their
   accessible card names did not. When two loaded records share a case-folded
   name and city, each accessible name now also includes its address.
5. A failed external Maps handoff could reject without a user-facing result. The
   detail screen now presents an inline assertive `Maps couldn't be opened. Try
   again.` state and keeps the action available for retry.
6. Canonical provider addresses already contain the city, but map queries added
   the city again. Queries now use only the canonical name and address.

Regression coverage protects each material fix. The expanded database contract
test also now creates its own missing-details/hours fixture instead of depending
on a seed record remaining unenriched; this keeps the suite valid against both a
clean seed and a provider-enriched dataset.

## Duplicate and Data Review

Five exact-name groups were reviewed: three Scooter's Coffee locations and two
each for 7 Brew Coffee, Hyper Energy Bar, Little Free Library, and Mr. D's Coffee.
Their addresses distinguish legitimate physical locations. Ten close-proximity
pairs from the dataset audit were also reviewed, including host/tenant and
adjacent public-space relationships. No suspected true duplicate was found, and
no record was merged, deleted, or hidden by a client heuristic.

The audit recorded source-quality follow-ups rather than silently rewriting
provider-backed facts:

- `Kickapoo Park RIGHT` has a suspicious provider name.
- Heritage Forest Park has the malformed-looking provider address
  `F fTy W v. Pflumm Rd &, W 83rd St`.
- Raven Ridge Park has leading punctuation in its provider name.
- Boba Tea has an area-only address and is honestly presented as an approximate
  location.
- `Hermetheus Downtown Olathe Library` is provider-classified as a cafe and may
  represent a host/tenant relationship.
- A future product/data model may represent parent, tenant, or related locations;
  this ticket does not infer those relationships or collapse records.

These findings are non-release-blocking because the current UI retains the
source-backed identity, displays address precision honestly, and distinguishes
the records without unsupported claims.

## Interaction and Accessibility Evidence

Expo Web was checked at a wide desktop viewport, 390 by 844 CSS pixels, and an
approximately 200% reflow width. The longest name, long addresses, same-name
cards, approximate location, unavailable hours, unverified details, no-match
recovery, filter entry/exit, keyboard focus, browser Back, and external-action
states remained readable and operable without observed horizontal clipping.

An iPhone 17 / iOS 26.5 Simulator running Expo Go 57.0.9 was checked at the
standard Large content-size category. The 160-place list and filter surface
exposed meaningful link/button roles and selected traits; filter controls,
Close, Clear all, and Apply had measured accessibility frames at least 44 points
high. The development-only Expo Go floating control overlapped part of the modal
visually; it is not shipped KC3 UI.

This proportional pass does not claim spoken VoiceOver or TalkBack evidence.
KC3-34 continues to own the user-attended screen-reader gate for KC3-21/KC3-23.

## Verification

The final local verification covers application tests, strict typechecking,
ESLint, formatting, whitespace checks, 228 pgTAP assertions, database lint, six
live anonymous integration tests against all 160 records, and Web/iOS/Android
Expo exports. The integration path continues to prove direct anonymous table
access is denied. No public RPC, schema, dependency, or production credential
changed.

Configured CI is not claimed until a branch is pushed and its hosted workflow
runs. The equivalent repository commands pass locally. No release-critical
regression remains from this audit, so KC3-34 continues to govern the existing
KC3-21/KC3-23 closeout gate.
