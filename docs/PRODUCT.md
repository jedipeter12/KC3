# Product

## Product Summary

KC3 is a planned app for helping people find third places in the Kansas City
metro area.

## Problem

It is difficult to know which nearby places are open and fit a person's needs.
Examples include finding somewhere inexpensive, somewhere suitable for working,
or somewhere that also serves food. KC3 is intended to make those tradeoffs
easier to evaluate in one place.

## Target Users

People in the Kansas City metro looking for third places where they can spend
time, work, or meet others.

## Core User Outcomes

Find places that match selected needs and preferences. The approved first slice
supports place-name search plus city and place-type filtering over the public
place list. The approved KC3-29 follow-on adds a scannable summary, dedicated
place details, regular-hours status, and verified suitability filters while
preserving explicit unknown and freshness states.

## MVP Scope

### Included

- A Supabase data foundation for individual places, Google-sourced metadata,
  KC3-specific place details, and weekly hours.
- The approved schema supports curated place records and preserves unknown detail
  values without requiring user accounts.
- An initial local-development seed of 15 real places across Lenexa, Overland
  Park, and Olathe, using only verified canonical names and addresses while
  leaving unverified details, Google metadata, and hours unknown.
- A reviewed, bounded local MVP dataset built and repeat-verified through the
  Google ingestion path: 164 canonical/provider-backed places across the same
  three cities, all 15 representative seeds reconciled, with search caps and
  provider variability documented rather than represented as exhaustive. A
  fresh KC3-33 audit returned 160 active records, reinforcing that each bounded
  run is a current provider result rather than a fixed product inventory.
- Anonymous, read-only discovery of active places through an approved public
  projection containing only place ID, name, city, address, and place type.
- The approved public discovery boundary does not require accounts and does not
  permit client writes or direct access to the underlying place tables.
- A list-first Expo client slice that shows the public projection, supports
  client-side name search and city/place-type filters, and handles loading,
  empty, and error states.
- The first client slice targets mobile and Expo Web and does not require a map,
  accounts, writes, hours, or a place-detail screen.
- An implemented anonymous data contract for the next public slice, with
  bounded summary/detail operations, structured address precision, effective
  regular hours, source-specific freshness, KC3-owned suitability fields, and
  separate nullable drive-thru concepts. See
  [`KC3_30_PUBLIC_PLACE_CONTRACT.md`](KC3_30_PUBLIC_PLACE_CONTRACT.md).
- An implemented mobile-first and responsive Expo Web summary/detail experience
  with regular-hours states, verified-attribute filters, default drive-thru-only
  exclusion, complete detail sections, external map launch, and list context
  preservation.
- An internal attended operator CLI for selecting an existing active,
  provider-backed place and maintaining only KC3-owned suitability and
  verification details with explicit unknown states and confirmation.

### Explicitly Not Included

- No features have been permanently excluded. The later-feature candidates below
  are not approved for the MVP.

## Approved List-first MVP Client Slice

The first client implementation is intentionally bounded to the existing public
RPC contract:

- Display active places in a list with name, city, address, and place type.
- Support client-side name search and city/place-type filters.
- Provide loading, empty, and sanitized error states.
- Use a mobile-friendly layout that also works through Expo Web.
- Do not add a map, accounts, client writes, hours, Google metadata, or a
  place-detail screen in this slice.

### Current Implementation

The first screen now loads the approved public projection once and renders
returned places in server order. Each list item shows its name, city, address,
and a human-readable place type. Users can search names without case sensitivity
or surrounding-whitespace sensitivity and select one city and one place type;
active constraints combine with AND behavior. City and type choices come only
from the loaded records, clearing restores the full loaded list, and filtering
does not make another database request. A no-match result is distinct from a
successful database-empty state.

The screen also includes visually distinct loading and sanitized error states;
the error state provides a retry action. The layout uses a bounded content width
on Web and keeps the controls and results scrollable on small mobile viewports.

Filter selection is exposed to assistive technology, controls support Web
keyboard operation, and iOS request-state changes have explicit announcements.
Practical native large-text verification is complete; user-attended spoken
screen-reader checks remain outstanding in `docs/ACCESSIBILITY_REVIEW.md`.

## Implemented KC3-29 Follow-on Experience

KC3-29 approves a dedicated place-details screen reached from the list. Cards
remain compact: identity, address, usable regular-hours state, and a small KC3
summary. Details contain the complete effective weekly schedule and KC3-owned
seating, outlets, Wi-Fi, work, food, phone-call, bathroom, drive-thru, and
verification information. Unknown, unavailable, and stale states use distinct
language, and provider refresh never becomes a KC3 verification claim.

The richer list retains name, city, and place-type controls and adds verified
attribute filters. Drive-thru available and drive-thru only are separate
nullable facts; verified drive-thru-only places are hidden by default but may be
included. The exact approved matrix, copy, freshness thresholds, navigation, and
platform/accessibility contract are normative in
[`KC3_29_PLACE_EXPERIENCE.md`](KC3_29_PLACE_EXPERIENCE.md).

KC3-30 implements and authorizes the required anonymous public data contract
while preserving the old five-field RPC for compatibility. KC3-31 now adopts the
summary and detail operations. Mobile-width Web uses an Apply-based filter
surface; Web at 960 CSS pixels and wider uses a persistent filter rail. Cards
navigate by stable KC3 ID, Web uses browser history, and returning restores the
applied query/filter state and originating-card focus. Practical native
large-text checks are complete; spoken screen-reader verification remains open;
see
[`KC3_31_IMPLEMENTATION.md`](KC3_31_IMPLEMENTATION.md).

KC3-33 validates this experience against every record in a fresh 160-place
bounded run. Loaded filter choices now use the stable approved city/type order,
same-name locations in the same city include their address in the accessible
card name, external Maps failures produce an honest retryable state, and Web
history restoration returns to the originating card. Missing hours, approximate
addresses, and unverified KC3 details remain useful explicit states rather than
being hidden or inferred. Broader source corrections and parent/tenant modeling
remain follow-up work; the client does not merge legitimate records or rewrite
provider-backed identity. See [`KC3_33_AUDIT.md`](KC3_33_AUDIT.md).

## Later Client Feature Candidates (Not Yet Approved)

The following client-facing ideas were discussed as a plausible MVP shape. They
are preserved for Product Owner review and must not be treated as implementation
tickets until approved. The place data model itself is approved separately below.

- Map presentation.
- Place categories or tags beyond the six approved types, cost to occupy,
  website, ratings, phone number, and live/special hours.
- Distance sorting, geolocation, and deployment.

## Approved MVP Data Model

The approved MVP schema uses an individual physical place as its canonical record
and separates data by ownership and purpose:

- `places` stores the canonical name, city, address, place type, optional unique
  Google Place ID, and lifecycle status.
- `place_google_data` stores optional Google-derived attributes separately from
  KC3-owned details. The approved MVP allowlist and refresh behavior are defined
  in [`GOOGLE_INGESTION_CONTRACT.md`](GOOGLE_INGESTION_CONTRACT.md); unrestricted
  raw responses and phone data are not retained by that workflow.
  `google_fetched_at` records the latest successful validated provider response;
  it is provider freshness, not a KC3 verification claim.
- `place_details` stores seating notes, outlets, Wi-Fi, work suitability, food and
  beverage level, nullable verified/unknown booleans, separate nullable
  drive-thru available and drive-thru-only facts, and verification metadata.
- `place_hours` stores zero or more intervals per place and day, including closed
  days, overnight closing, source, and verification metadata.
  Google rows use `source_observed_at` for the response that produced the stored
  schedule, while KC3 rows use it for their own curation observation. A Google
  refresh never changes `place_details.last_verified_at`.
- `place_overrides` stores non-destructive, effective-dated KC3 factual overrides
  while retaining provider values underneath.

Canonical places may retain accepted latitude/longitude and an IANA timezone for
future map, distance, clustering, navigation, and local-date override behavior.
An old physical place may link to a distinct replacement place after a move; a
move never transfers KC3-owned suitability data automatically.

Approved place types are coffee shop, cafe, boba/tea, library, coworking, and park.
Approved place statuses are active, temporarily closed, permanently closed, and
hidden. Detail classifications include explicit `unknown` values where specified;
nullable booleans use `true` for verified yes, `false` for verified no, and `null`
for unknown.

Hours use `0` for Sunday through `6` for Saturday. Multiple rows per place and day
are allowed so split operating periods can be represented.

## User Experience Principles

- Never turn missing or unverified information into a positive or negative fact.
- Keep the list scannable and move complete schedules, nuanced detail, and
  provenance to a dedicated place screen.
- Make verified negative values as explicit as verified positive values.
- Treat freshness as part of a claim: hours freshness and KC3 verification are
  different and must remain visibly separate.
- Preserve long and unusual real values without truncation or heuristic cleanup;
  correct source data through a reviewed curation workflow.
- Use the same information hierarchy and operable semantics on mobile and Expo
  Web, with touch, keyboard, large-text, and screen-reader behavior designed in.

## Business / Product Constraints

- Budget: Not documented.
- Platform: React Native with Expo, initially targeting mobile and Expo Web.
- Privacy: Not documented.
- Accessibility: KC3-29 requires semantic navigation and detail structure,
  44-by-44 minimum targets, visible keyboard focus, focus restoration, state
  announcements, Dynamic Type, and 200-percent Web reflow. Native manual gaps
  from KC3-21 remain open.
- Geography: the current MVP remains limited to Lenexa, Overland Park, and
  Olathe and is explicitly non-exhaustive.
- Other: Keep the MVP boundary clear and deliver work in small, reviewable
  tickets.

## Open Product Questions

- Should KC3 consistently call these locations "third places" or "third spaces"?
  The source context uses "third place," while the original repository summary
  used "third space."
- When, if ever, should map presentation enter the MVP?
- Which authorized operators will own the documented suitability-verification
  cadence? The attended maintenance workflow now exists, but staffing and
  cadence remain product/operations decisions.
- Do any future candidate MVP features require user accounts?
- When should KC3 expand beyond the approved three-city geography?
- Which hosting/release path and broader privacy requirements apply before
  deployment?

## Future Ideas

Ideas worth preserving that are not current commitments include:

- User accounts, except where a future confirmed feature requires them.
- User-submitted places or updates.
- Freshness reports.
- An "I'm working here" status.
- Notifications.
- Community or social features.
- Complex moderation.
- Real-time occupancy.
