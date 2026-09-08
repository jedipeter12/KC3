# Google Places Ingestion Contract

**Status:** Accepted for KC3-24  
**Applies to:** the future manual KC3-25 importer and later refresh workflows  
**Does not implement:** an importer, Google API calls, scheduling, credentials, or an admin UI

This is the durable policy and transformation contract for Google Places data.
Repository schema and tests enforce stable storage invariants; the future trusted
importer must enforce workflow rules that span a complete response.

## Google request contract

Use Place Details (New) and this exact `X-Goog-FieldMask` value:

```text
id,displayName.text,formattedAddress,addressComponents,location,businessStatus,primaryType,types,regularOpeningHours.periods,timeZone.id,movedPlaceId,googleMapsUri,rating,userRatingCount,websiteUri,priceLevel
```

The mask requests only approved fields. It intentionally omits phone numbers,
`currentOpeningHours`, secondary hours, reviews, photos, and all atmosphere fields
such as seating and restroom signals. The MVP schema has no phone or unrestricted
raw-response column. Full Google responses must not be retained without a later
explicit retention, privacy,
licensing, and access decision.

Google documents field masks as required, comma-separated response paths; nested
paths are valid. It documents `id` as the standalone Place ID, `displayName` as
the human-readable name, `timeZone.id` as an IANA identifier, and
`regularOpeningHours.periods` as place-local weekly periods. See the official
[Place Details field-mask guide](https://developers.google.com/maps/documentation/places/web-service/place-details),
[Place resource](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places),
and [field/SKU table](https://developers.google.com/maps/documentation/places/web-service/data-fields).
The mask reaches the Place Details Enterprise tier because approved fields
include regular hours, rating, rating count, website, and price level; it does
not reach Enterprise + Atmosphere.

## Field mapping and ownership

`places.id` remains the durable KC3 identity. Google Place ID is a unique,
nullable provider identity and never a primary key.

| Google response field | Provider storage | Canonical/effective use | Write owner |
| --- | --- | --- | --- |
| `id` | `places.google_place_id` | Matches repeat refreshes; never replaces `places.id` | Google identity, attached only by trusted import/operator resolution |
| `displayName.text` | `place_google_data.google_name` | Initializes `places.name`; cosmetic changes may refresh it and substantive changes are reported | Google provider copy; accepted canonical name is factual KC3 data |
| `formattedAddress` | `place_google_data.google_address` | Initializes `places.address`; cosmetic changes may refresh it and substantive changes are reported | Google provider copy; accepted canonical address is factual KC3 data |
| `addressComponents` | `place_google_data.google_address_components` | Extracts a city candidate by component type, never array position | Google |
| `location.latitude` / `.longitude` | `place_google_data.google_latitude` / `google_longitude` | Initializes accepted `places.latitude` / `longitude`; meaningful movement is reviewed | Google provider copy; accepted coordinates are factual KC3 data |
| `businessStatus` | `place_google_data.google_business_status` | May drive `places.status` under the lifecycle rules below | Google, except KC3-only `hidden` state |
| `primaryType` | `place_google_data.google_primary_type` | Informational candidate only; never changes `places.place_type` | Google provider value; KC3 owns normalized classification |
| `types` | `place_google_data.google_types` | Informational candidates only; never changes KC3 classifications | Google |
| `regularOpeningHours.periods` | Current `place_hours` rows with `source = 'google'` | Provider fallback weekly schedule | Google |
| `timeZone.id` | `place_google_data.google_time_zone` | Initializes accepted `places.time_zone`; accepted IANA value evaluates overrides | Google provider copy; accepted timezone is factual KC3 data |
| `movedPlaceId` | `place_google_data.google_moved_place_id` | Resolves a new KC3 place and then `places.moved_to_place_id` | Google provider relationship plus KC3-resolved relationship |
| `googleMapsUri` | `place_google_data.google_maps_uri` | Provider link only; future navigation must also support name/address/coordinates | Google |
| `rating` | `place_google_data.google_rating` | Provider metadata only | Google |
| `userRatingCount` | `place_google_data.google_user_rating_count` | Provider metadata only | Google |
| `websiteUri` | `place_google_data.google_website_uri` | Provider website only | Google |
| `priceLevel` | `place_google_data.google_price_level` | Provider metadata only; not KC3 food/beverage classification | Google |

City extraction is deterministic: find the first component by priority
`locality`, `postal_town`, then `administrative_area_level_3`, considering types
rather than component order, and use its `longText`. No match means “not supplied”
for refreshes and blocks creation of a new place whose required city is unknown.

### Writable table ownership

- `places`: KC3 identity and accepted canonical facts. Google may initialize and
  refresh name, city, address, coordinates, timezone, and provider-derived
  lifecycle states only under this contract. Only an operator supplies or
  changes `place_type`. `hidden` and `moved_to_place_id` are KC3-controlled.
- `place_google_data`: Google owns every `google_*` value. `created_at` and
  `updated_at` are database audit timestamps. There is no unrestricted raw or
  phone storage in the MVP schema.
- `place_details`: KC3 owns every domain field and `last_verified_at`; Google
  ingestion must never insert, update, or delete these rows.
- `place_hours`: the importer may replace only the complete set of rows whose
  `source = 'google'`. It must never update or delete `source = 'kc3'` rows.
  `source_observed_at` is the Google fetch time for Google rows and the KC3
  observation time for KC3 rows.
- `place_overrides`: KC3 owns all fields and payloads. Provider refreshes never
  change or delete overrides. Database-generated IDs/timestamps and the shared
  `updated_at` trigger remain database-owned.

## Comparison rules

The pure reference implementation is in `src/ingestion/googleContract.ts` and is
covered by fixtures in `tests/google-contract.test.ts`.

For names and formatted addresses:

1. Treat an omitted or null incoming value as missing, not as a clear.
2. Exact equality is unchanged.
3. Otherwise apply Unicode NFKC normalization, lowercase with the fixed `en-US`
   locale, replace `&` with `and`, replace Unicode punctuation/symbol runs
   (including apostrophes and hyphens) with spaces, collapse whitespace, and trim.
4. Equal normalized strings are cosmetic and may update the accepted canonical
   presentation. Unequal strings are substantive and must not update canonical
   data without operator approval.

This deliberately does not equate abbreviations, remove diacritics, reorder
tokens, or use fuzzy/AI similarity. Thus `Black-Dog Coffeehouse` and
`Black Dog Coffeehouse` compare as cosmetic, while `Station 3 Coffee` and
`Station 3 Coffee & Kitchen` compare as substantive.

Coordinate differences use the haversine distance and a 100-meter review
threshold. Missing incoming coordinates preserve existing values. A first valid
pair initializes coordinates. A change at or below 100 meters is treated as
provider jitter; a larger change is a movement candidate and blocks canonical
location mutation pending review. A substantive address change is always
reported even within 100 meters. The threshold is a conservative screening rule,
not proof that a business moved.

## Import and refresh state machine

### Validate before writing

A response must have the requested `id`, and every present value must match its
documented shape/range. Coordinates must be a complete pair. New places also
require nonblank name, formatted address, deterministically extracted city,
valid coordinates, valid IANA timezone, and an operator-supplied KC3
`place_type`. Invalid or incomplete required data produces a report and no write.

An API error, timeout, malformed response, unknown provider enum, invalid hours,
or interrupted fetch does not prove that an old value disappeared. It must not
alter stored canonical, provider, KC3 detail, hours, override, or freshness data.

### Identity, duplicates, and new places

1. Match a non-null Google `id` to the unique `places.google_place_id`. Exactly
   one match refreshes that KC3 place.
2. If no ID matches, search for possible duplicates using normalized name,
   normalized address, and coordinates within 100 meters. A candidate match is
   reported and causes no write until the operator explicitly chooses “attach to
   existing” or “create new.” Never merge based on name alone.
3. Creating a place is an explicit operator action because Google types cannot
   choose KC3's normalized `place_type`. Insert one new KC3 UUID, its provider
   identity/data, accepted canonical factual values, and valid Google hours in a
   single transaction. Do not copy KC3 details from another place.
4. The unique Google Place ID constraint is the final concurrency guard. A
   uniqueness conflict rolls back and is re-read as a possible concurrent import;
   it must not create a second place.

### Repeat refresh and missing values

Build a complete change plan in memory before opening the transaction. Each
present, valid provider field updates its provider column; an omitted/null field
keeps the existing provider value. An explicit empty array also preserves a prior
value for `types` or `addressComponents`, because Google documents components as
potentially missing or variable and emptiness is not a reliable clearing signal.
The only MVP clear/change signals are recognized provider enums and the explicit
hours behavior below.

Canonical factual values initialize when unknown. Cosmetic name/address changes
may update canonical presentation. Substantive name/address changes update the
provider copy but leave canonical values unchanged and appear in the operator
report. Coordinates at or below the review threshold may refresh accepted
coordinates; larger differences abort the place refresh as a movement candidate.
Timezone changes are substantive location signals and require review.

The same input may be run repeatedly without duplicate places, Google rows, or
hours. A no-data-change refresh still advances `google_fetched_at` after a valid
transaction commits; that timestamp is intentionally the one non-idempotent
observation value.

### Lifecycle status

- `OPERATIONAL` maps to `active`, `CLOSED_TEMPORARILY` to
  `temporarily_closed`, and `CLOSED_PERMANENTLY` to `permanently_closed`.
- Never replace `places.status = 'hidden'`; that is a KC3 decision.
- For any other existing status, auto-transition only when the current canonical
  status agrees with the previously stored Google status (or provider status is
  being initialized). This prevents Google from reversing an independent KC3
  lifecycle decision.
- `FUTURE_OPENING` and `BUSINESS_STATUS_UNSPECIFIED` are retained only in the
  provider column because the KC3 enum has no equivalent; canonical status is
  preserved.
- Temporary closure keeps the place and normal weekly schedule. Permanent
  closure keeps the place and all KC3 data but removes it from the existing
  active-only public RPC. Google ingestion never deletes a place.

### Movement

`movedPlaceId` on a permanently closed listing is authoritative evidence of a
replacement listing, not permission to mutate the old physical place. Fetch and
validate both listings first, then use one transaction to:

1. retain the old KC3 place and all KC3-owned data;
2. store its `google_moved_place_id` and set its provider/canonical closure state;
3. resolve or create a different KC3 place for the new Google ID, with a new KC3
   UUID and separately supplied KC3 `place_type`;
4. set old `places.moved_to_place_id` to the new KC3 place; and
5. write only the new place's provider facts and Google hours, never copying old
   details, KC3 hours, verification timestamps, or overrides.

The resolver must reject self-links and movement cycles. The database rejects a
direct self-link; the importer must check longer chains before writing.

A location change over 100 meters without `movedPlaceId` is only a movement
candidate. Report it and make no changes for that place until the operator
classifies it as a provider correction or a move.

## Regular weekly hours

Only `regularOpeningHours.periods` is accepted. Ignore localized weekday text,
`currentOpeningHours`, `specialDays`, secondary hours, open-now values, and
holiday/temporary schedules.

- Missing `regularOpeningHours` or missing `periods`: preserve existing Google
  rows; on a new place, leave hours unknown (zero rows).
- Empty `periods` plus `CLOSED_TEMPORARILY`: preserve the normal schedule.
- Other explicit empty `periods`: replace with seven closed-day rows.
- Each point must contain integer day `0..6`, hour `0..23`, and minute `0..59`.
  Day numbering already matches KC3 (`0` Sunday through `6` Saturday).
- A period must close later on the same day or on the immediately following day.
  Store the latter with `closes_next_day = true`. Multiple non-overlapping
  intervals per day remain separate rows.
- Google's documented 24/7 sentinel—one Sunday 00:00 open point with no close—is
  expanded to seven 00:00-to-00:00 next-day rows.
- Add a closed row only for a day with no open-time coverage, including coverage
  carried across midnight. Reject duplicate/overlapping periods and any schedule
  the model cannot represent.
- For a valid changed schedule, delete all and only prior Google rows and insert
  the full normalized Google schedule in the same transaction. Missing or
  invalid schedules do not delete anything.

## Manual and effective-dated overrides

`place_overrides` keeps manual values separate from provider values. Date bounds
are inclusive; a null end date means open-ended. Ranges for the same place and
override type cannot overlap. The initial hours payload contract uses
`override_type = 'regular_hours.v1'` and an object containing a version plus a
complete array of normalized rows matching the `place_hours` shape. Future types
must be versioned and validated by their writer before storage.

`active_place_override_value(place, type, instant)` converts the instant to the
accepted `places.time_zone` and returns the active payload. A place must have a
valid IANA timezone before an override can be used. Effective reads resolve:

1. active KC3 effective-dated override;
2. an existing complete KC3-owned base schedule where applicable;
3. current Google/provider value; then
4. unknown.

An expired override remains as history and naturally falls back to the refreshed
provider value. Google refreshes never overwrite or erase it.

## Atomicity and timestamps

Each place refresh is one PostgreSQL transaction covering accepted canonical
fields, the one-to-one provider row, lifecycle/link changes, and wholesale Google
hours replacement. A move resolution that touches two physical places is one
transaction. Fetching and validation happen before the transaction. Any write,
constraint, or commit failure rolls back the whole unit; the CLI reports failure
and must not advance freshness separately.

- `place_google_data.google_fetched_at`: provider response receipt time recorded
  only when a successful validated refresh transaction commits, including a
  repeat with no data changes.
- `place_hours.source_observed_at`: same fetch time for rows sourced from Google;
  KC3 observation time for rows sourced from KC3.
- `created_at`: database row creation time.
- `updated_at`: database mutation time maintained by trigger; not a source
  verification claim.
- `place_details.last_verified_at`: KC3 verification date for KC3-owned details.
  Google calls must never set or reset it.

## Required scenario outcomes

| Scenario | Required result |
| --- | --- |
| Brand-new Google place | Explicit operator classification; atomically create new KC3 UUID, provider row, canonical facts, and valid Google hours |
| Repeat with no changes | No duplicates; advance only provider observation timestamps |
| Cosmetic name change | Update provider and canonical presentation |
| Substantive name change | Update provider copy, preserve canonical name, report review |
| Cosmetic address change | Update provider and canonical presentation |
| Material address/location change | Preserve stored state and report movement/correction review |
| Missing populated field | Preserve stored provider and canonical values |
| Missing hours | Preserve old Google hours, or unknown for a new place |
| Normal weekly-hours change | Atomically replace only the complete Google schedule |
| Overnight hours | One row on opening day with `closes_next_day = true` |
| Temporary closure | Keep place and normal hours; provider/canonical temporary status |
| Permanent closure | Keep place/KC3 data; mark permanently closed and exclude from active RPC |
| Listing moved | Retain old place, create/resolve new place, link them, copy no KC3 enrichment |
| Existing KC3 details | Never touched by provider refresh |
| Active manual override | Override wins while provider refresh remains stored underneath |
| Expired override | Provider value becomes effective without deleting override history |
| Partial response/interruption | Validation failure or transaction rollback leaves prior state intact |

## Deferred to KC3-25 or later

- Trusted manual CLI, credentials, API calls, operator prompts/reports, and
  transaction implementation.
- A least-privilege production import role or RPC. No new Data API grant is part
  of this contract.
- Override creation/display UI or a public effective-value API.
- Scheduled refresh, retry policy, monitoring, map/navigation UI, and the real
  Johnson County dataset.
- Raw-response retention and phone ingestion.
