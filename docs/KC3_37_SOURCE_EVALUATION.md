# KC3-37 Alternate Place Sources

Evaluated 2026-10-02 (America/Chicago). Research supports a sourcing decision;
the Product Owner subsequently selected Overture as the starting source.
The research itself does not approve an import or publication rule.
Accessibility remains on hold. Related: [remediation plan](KC3_37_REMEDIATION_PLAN.md).

## Recommendation

Accepted by the Product Owner on 2026-10-02. Workbook and import preparation are
documented in [Overture Review](OVERTURE_REVIEW.md); launch remediation remains open.

Overture Places is a promising downloadable baseline for KC3 identity data,
followed by attended curation. It avoids starting the entire directory from
manual entry. The sample has substantial coffee/cafe/park coverage, but raw
counts overstate eligible third places. Libraries, coworking, municipality,
duplicates, lifecycle, and address precision require review. Weekly hours need
a separate sourcing and maintenance workflow.

Foursquare OS Places remains a candidate, but its current direct catalog needs
a Places Portal account/token. The Product Owner chose to continue with
Overture for now instead of signing in. No direct Foursquare coverage count or
quality ranking is claimed. Foursquare contributions inside Overture are a
subset, not a measurement of the full Foursquare dataset.

No existing Google content was exported for this evaluation. No existing place,
KC3 detail, correction history, schema, or app behavior was changed. The Google
agreement/export check remains open; replacement data does not retroactively
clear old copies.

## Measured Overture coverage

Source: Overture Maps Foundation, overturemaps.org; accessed 2026-10-02, release
`2026-09-23.1`, Places theme only. Official
[download instructions](https://docs.overturemaps.org/getting-data/duckdb/)
and [catalog](https://stac.overturemaps.org/catalog.json).

Downloaded a rectangular regional sample spanning longitude -95.02 through
-94.58 and latitude 38.68 through 39.08. It contains 46,859 records across all
categories. First-address postal locality, trimmed and case-normalized, selects
24,717 records in Lenexa, Olathe, and Overland Park. This is a postal-locality
screen, not a point-in-municipal-boundary census. It may miss locality aliases
or mislocated records and include places outside municipal limits.

The provisional mapping uses primary taxonomy only: `coffee_shop`, `cafe`,
`bubble_tea_shop`/`tea_room`, `library`, `coworking_space`, and `park`. It yields
462 candidates. Alternate taxonomy is not counted; coffee roasteries, internet
and cat cafes, dog/skate/national/water/amusement/mobile-home parks, parking,
and unrelated substring matches are excluded pending deliberate category review.
These are research mappings, not changed product eligibility.

Each cell is **raw candidates / operating-status open and confidence >= 0.75**.
`open` means continued operation, not open at this moment. Confidence estimates
existence, not address/category accuracy or suitability. The threshold is a
sensitivity probe, not an approved import or publication rule.

| KC3 type | Lenexa | Overland Park | Olathe | Total |
| --- | ---: | ---: | ---: | ---: |
| Coffee shop | 22 / 16 | 81 / 66 | 38 / 32 | 141 / 114 |
| Cafe | 6 / 5 | 23 / 15 | 5 / 3 | 34 / 23 |
| Boba/tea | 2 / 0 | 12 / 9 | 4 / 4 | 18 / 13 |
| Library | 2 / 2 | 15 / 8 | 17 / 9 | 34 / 19 |
| Coworking | 2 / 2 | 1 / 1 | 0 / 0 | 3 / 3 |
| Park | 44 / 30 | 117 / 51 | 71 / 36 | 232 / 117 |
| Total | 78 / 55 | 249 / 150 | 135 / 84 | 462 / 289 |

Raising confidence to >= 0.95 while requiring `open` reduces the sample to
122 candidates. Requiring a street address as well reduces the >= 0.75 sample
from 289 to 271. Neither subset is a verified launch inventory. In particular,
both Lenexa boba records have unknown lifecycle, so treating unknown as closed
would discard potentially useful coverage.

See the [Place schema](https://docs.overturemaps.org/schema/reference/places/place/)
for lifecycle, confidence, and available fields. No weekly-hours field is in
this schema or the inspected Parquet schema; no current-hours coverage was
measured. Coordinates are present in the selected point records, but their
entrance/rooftop accuracy was not independently validated. Timezone is not a
Place field in this sample; preserving or deriving it needs its own evidence.

## Quality and freshness

Among 462 candidates: 462 unique Overture IDs; no missing names; 67 missing
street addresses; 47 missing postcodes; 288 with a website. Lifecycle is `open`
for 301, unknown for 158, and permanently closed for 3. These missing-field
counts concern the first address, not every alternate address.

A normalized same-name/same-street check finds one duplicate group: two Dinh
Tea and Coffee Shop records at 12236 W 95th St, Lenexa, classified differently.
This limited check does not rule out aliases, coordinate duplicates, old
locations, or related but distinct businesses. Multi-location brands must not
be merged solely by name.

There are concrete reasons not to auto-publish even high-confidence entries:

- Lackman Library is marked operating with confidence about 0.92. Johnson
  County identifies Lenexa City Center as its replacement. That old library
  record needs lifecycle/public-use review despite its recent metadata.
  [County source](https://www.jocogov.org/newsroom/johnson-county-library-welcomes-new-county-librarian).
- Library candidates include school libraries, a parking lot, and Designers
  Carpet Library. Category membership alone does not establish public access or
  KC3 suitability. Coworking includes Performance Contracting Inc; all three
  coworking candidates need identity/category review.
- Overture has Sweet Tee's at both its main store and library cafe, plus a
  Downtown Library record still marked operating. The business explicitly says
  its downtown cafe closed on 2025-01-01 and has another operator. Its two other
  locations should not be deduplicated into one place.
  [Business source](https://www.sweetteescoffeeshop.com/).

Source metadata contributing to candidates:

| Contributor | Records with contribution | Metadata update range | License tag |
| --- | ---: | --- | --- |
| Meta | 356 | 2026-08-24 to 2026-09-14 | CDLA Permissive 2.0 |
| AllThePlaces | 39 | 2026-09-09 | CC0 1.0 |
| Foursquare | 28 | 2021-03-09 to 2026-04-13 | Apache 2.0 |
| Microsoft | 24 | 2011-03-19 to 2025-09-11 | CDLA Permissive 2.0 |
| BrightQuery | 15 | 2026-09-17 | CDLA Permissive 2.0 |
| Overture confidence calculation | 462 | 2026-09-17 | CDLA Permissive 2.0 |
| Overture operating signals | 299 | 2026-06-26 to 2026-09-14 | CDLA Permissive 2.0 |

Counts overlap. Update times describe contributing source metadata, not proof
that every field was independently checked on that date. The recent release and
confidence calculation must not become a blanket KC3 verification date.

## Existing seed overlap

Compared against the 15 repository bootstrap records in `supabase/seed.sql`,
whose citations are in [Seed Data](SEED_DATA.md), rather than exporting the
Google-backed database. Manual inspection finds plausible counterparts for all
15; that small, nonrandom sample does not measure directory completeness or
establish exact migration mappings. Fourteen counterparts meet the >= 0.75/open
probe; Olathe Downtown Library has confidence 0.95 but unknown lifecycle.

| Seed record | Overture candidate / review issue |
| --- | --- |
| Lenexa City Center Library | Johnson County Library - Lenexa City Center; 8778 Penrose Ln |
| Black Dog Coffeehouse | Same name; 12815 W 87th Street Pkwy |
| Maps Coffee & Chocolate | Same name; 13440 Santa Fe Trail Dr |
| Black Hoof Park | Same name; 9053 Monticello Rd |
| Sar-Ko-Par Trails Park | Same name; 14915 W 87th St Pkwy versus seed 8801 Greenway Ln; entrance/address review |
| Blue Valley Library | Generic Johnson County Library name at 9000 W 151st St; branch identity review |
| Central Resource Library | Johnson County Library - Central Resource; 9875 W 87th St |
| Oak Park Library | Johnson County Library - Oak Park; 9500 Bluejacket Dr versus seed St; street-suffix review; another alias at same address |
| Homer's Coffee House | Same name/address; Overture cafe versus seed coffee shop |
| Pilgrim Coffee Company | Same name; 12643 Metcalf Ave |
| Olathe Downtown Library | Generic Olathe Public Library at 260 E Santa Fe St; unknown lifecycle |
| Olathe Indian Creek Library | Same name; 16100 W 135th St |
| Sweet Tee's Coffee Shop | Main-store counterpart at 2063 E Santa Fe St; distinguish cafe and obsolete location |
| Apogee Coffee & Draft | Same name; 670 N Central St |
| Black Bob Park | Same name; 14500 W 151st St |

No field was replaced based on these possible matches. Stable KC3 IDs must
survive a future reconciled import; external IDs are references, not replacement
KC3 primary keys.

## License, access, and ongoing work

Overture Places publishes source-specific permissive licenses. This sample's
source tags are CDLA Permissive 2.0, Apache 2.0, and CC0 1.0; no ODbL source tag
was observed in these candidates. Other Overture themes have different terms.
Keep record/field sources and applicable licenses, retain required license and
NOTICE material, and identify modifications where required. This is a more
appropriate published basis for durable reuse than assuming API caching grants
directory rights. [Overture licensing](https://docs.overturemaps.org/attribution/),
[CDLA terms](https://cdla.dev/permissive-2-0/),
[Apache terms](https://www.apache.org/licenses/LICENSE-2.0),
[Foursquare NOTICE](https://opensource.foursquare.com/places-notice-txt/).

The Overture sample was obtained without a provider account, access token, or
per-place API billing. That does not mean hosting, data transfer, processing, or
curation have zero cost. A future monthly refresh can be scheduled or manually
triggered as a candidate-diff review, keeping curated facts and KC3 observations
protected. Do not automatically overwrite curation or equate refresh with
verification. License/NOTICE packaging needs implementation review before
distributing a raw workbook or production dataset.

Foursquare's open schema contains useful identities, coordinates, categories,
quality flags, and refresh dates, but no weekly hours. Its refresh date concerns
any single reference. Open data licensing must not be assumed to cover its
commercial APIs or additional enrichment.
[Foursquare open schema](https://docs.foursquare.com/data-products/docs/places-os-data-schema),
[current access instructions](https://docs.foursquare.com/data-products/docs/access-fsq-os-places).
The inspected portal's Access Data tab explicitly required login/signup to
generate a catalog token. No account was created or agreement accepted.

For the desired spreadsheet workflow, Overture can supply a licensed candidate
sheet, with separate editable curated fields and evidence dates. An attended
validated import should preview changes, keep stable IDs, preserve unfinished
rows and KC3 enrichment, and handle hours explicitly. This describes the next
design to prepare after source selection; it is not an implemented importer.

## Reproduction and checks

Used the official DuckDB 1.5.6 macOS arm64 CLI as a temporary research tool in
`/private/tmp/kc3-37-sourcing`, not a project dependency or backend replacement.
Release artifact SHA-256:
`7f19ac71f0a4bde308a247ac556d93ee95c03adc327ec85eeab9113294f11dd5`.
The binary matched the vendor release digest. Only the official `httpfs`
extension was needed for selected attributes; it was installed in that temporary
directory. No credentials were used.

For a fresh run, create that temporary directory and install `httpfs` with the
extension directory set there. Then use a new scratch database path for the
extract; extraction intentionally fails if `regional_places` already exists:

```sh
/private/tmp/kc3-37-sourcing/duckdb /private/tmp/kc3-37-sourcing/fresh.duckdb < scripts/research/kc3-37-overture-extract.sql
/private/tmp/kc3-37-sourcing/duckdb -readonly -markdown /private/tmp/kc3-37-sourcing/fresh.duckdb < scripts/research/kc3-37-overture-evaluate.sql
```

The equivalent extraction and committed evaluation queries ran successfully.
Evaluation uses temporary views while the scratch database is opened read-only.
Per-city/type totals, unique IDs, missing fields, lifecycle, normalized duplicates,
source tags/dates, and seed candidates were inspected. Documentation whitespace
checks pass. No application tests/builds were needed because this research
changes no application behavior; implementation checks remain required for
KC3-37 completion.
