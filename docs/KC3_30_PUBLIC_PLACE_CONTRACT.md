# KC3-30 Public Place Contract

**Status:** Implemented data and anonymous-read contract; UI adoption belongs
to KC3-31

**Date:** 2026-09-22

## Purpose

KC3-30 implements the storage and least-privilege anonymous read boundary needed
by the approved KC3-29 place experience. It does not implement navigation,
cards, details UI, or new filters.

The existing `list_public_places()` operation remains unchanged so the current
five-field screen keeps working while KC3-31 adopts the expanded contract.

## Storage contract

- `places.address_precision` is `street_address`, `approximate`, or `unknown`.
  The provider ingestion path may initialize only an `unknown` value from
  structured address components. It never replaces an accepted KC3 value.
- `places.time_zone` is validated as an accepted PostgreSQL/IANA timezone when
  written. Existing non-null values are validated once when the migration runs,
  so public reads do not rescan the timezone catalog for every place.
- `place_details.drive_thru_available` and `drive_thru_only` are separate
  nullable booleans. `null` means not KC3-verified. `drive_thru_only = true`
  requires `drive_thru_available = true`; false does not prove seating.
- `place_overrides.source_observed_at` records factual observation separately
  from row update time and provider fetch time.
- Same-day open intervals must close after they open. An overnight or 24-hour
  interval must explicitly set `closes_next_day`.

Provider ingestion still cannot write `place_details`, KC3 hours, or overrides.
Google refreshes therefore cannot change KC3 suitability, amenity, drive-thru,
verification, or manual-override values.

## Effective regular hours

`kc3_effective_regular_hours(place_id, instant)` is an internal resolver. It
selects the first complete and valid seven-day schedule in this order:

1. an active `regular_hours.v1` effective-dated override;
2. a complete KC3-owned base schedule;
3. a complete Google schedule; or
4. no schedule.

The public response never exposes that internal source label. It exposes the
normalized intervals and the selected schedule's oldest observation timestamp.
For a missing, partial, malformed, or unobserved schedule, no lower-confidence
open/closed claim is invented unless a valid lower-priority source exists.

`kc3_regular_hours_status(place_id, instant)` evaluates the effective schedule
in the accepted IANA place timezone. Its public values are:

- `regular_hours_available`: whether a complete weekly schedule is available;
- `regular_hours_state`: `open`, `closed`, or `unknown`;
- `regular_hours_next_transition_at`: the next real opening or closure instant,
  or null when unknown or continuously open; and
- `regular_hours_observed_at`: the effective schedule observation time.

Exactly 14-day-old hours remain current. After 14 full days the weekly schedule
remains available on detail, but current state and transition become `unknown`.
Missing timezone also suppresses current state without exposing the timezone
publicly. Invalid timezones are rejected at the storage boundary. Split periods,
overnight intervals, closed days, and continuous 24-hour weeks retain their
structure.

## KC3 verification freshness

The RPCs return both `kc3_last_verified_at` and a typed
`kc3_verification_state`:

- `unverified`: no known KC3-owned value, no verification date, or no valid
  place timezone for local-date evaluation;
- `current`: at least one known KC3-owned value and verification is no more than
  180 place-local calendar days old; or
- `stale`: a known value whose verification is more than 180 place-local days
  old.

Exactly 180 days remains current. Provider timestamps never affect this state.

## Anonymous operations

### `list_public_place_summaries()`

Returns active places ordered by canonical name and ID. It contains only card
and local-filter fields:

- canonical ID, name, city, address, address precision, and place type;
- current regular-hours availability/state, next transition, and observation;
- outlets, Wi-Fi, work suitability, food/beverage, phone-call suitability,
  bathroom, drive-thru availability, and drive-thru-only values; and
- KC3 verification date and state.

Missing `place_details` rows normalize enum classifications to `unknown` and
nullable facts/dates to null. The summary excludes seating notes and full weekly
hours.

### `get_public_place_detail(target_place_id)`

Returns zero or one active place. An unknown, hidden, closed, or removed place
returns zero rows so lifecycle state is not disclosed. The detail has the
summary fields plus seating notes and the complete normalized effective weekly
schedule. Schedule objects contain only `day_of_week`, `open_time`,
`close_time`, `is_closed`, and `closes_next_day`.

Neither response contains Google identity, provider types or URIs, coordinates,
timezone, ratings, price, website, lifecycle status, internal verification
notes, source labels, credentials, or unrestricted timestamps.

## Authorization and compatibility

Both operations are stable security-definer functions owned by the existing
hardened `kc3_public_place_reader` `NOLOGIN` role. That role receives only the
additional column grants and active-row RLS policies required to build the two
responses. Only `anon` may execute the public operations. Data API roles retain
no direct table privileges or writes.

The old five-field RPC is deliberately preserved. Rollback before KC3-31 is a
migration rollback plus removal of the unused expanded client types; the live
screen continues to use the old operation. After KC3-31 adopts the new contract,
rollback must restore the compatible client and database versions together.

## Verification

Database coverage proves clean migration reset, schema constraints, exact RPC
fields, active-only behavior, role ownership, RLS/privilege boundaries, unknown
normalization, effective-source priority, 14-day and 180-day thresholds,
next-transition behavior, 24-hour handling, and drive-thru combinations.
Application coverage proves exact TypeScript shapes, nested schedule validation,
sanitized malformed-response behavior, and exclusion of unexpected fields. The
live integration suite calls both operations with the anonymous local client and
continues to prove direct table denial.
