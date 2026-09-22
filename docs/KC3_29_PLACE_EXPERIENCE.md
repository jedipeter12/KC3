# KC3-29 Place-Finding Product and Interaction Contract

**Status:** Approved product contract; implementation is deferred to KC3-30 and
KC3-31

**Date:** 2026-09-21

**Applies to:** anonymous place discovery in Lenexa, Overland Park, and Olathe

## Purpose and boundary

This contract defines the next public KC3 place-finding experience after the
five-field list-first slice. It approves a dedicated place-details screen,
regular-hours presentation, richer KC3 suitability information, and filters over
those approved fields. It does not implement or expose them.

The experience remains:

- anonymous and read-only;
- limited to active places in Lenexa, Overland Park, and Olathe;
- limited to coffee shops, cafes, boba/tea places, libraries, coworking spaces,
  and parks;
- list-first, with no map browsing surface, accounts, submissions, or writes;
- honest that the provider-backed dataset is bounded and non-exhaustive; and
- source-aware: provider facts, effective hours, and KC3-owned suitability facts
  must not be presented as though they have the same provenance.

The current five-field RPC and UI remain the implemented behavior until KC3-30
and KC3-31 replace or extend them. This document does not authorize direct table
access, new client credentials, provider identifiers, raw provider payloads, or
internal curation notes.

## Dataset findings that drive the contract

The KC3-28 local snapshot was reviewed directly rather than through synthetic
fixtures:

- 164 active places have canonical and provider records.
- 159 places have a stored regular weekly schedule; five have no usable regular
  hours.
- Only the 15 reconciled seed identities have a `place_details` shell.
- Zero places currently have a KC3 detail verification date. Every current
  seating, outlet, Wi-Fi, work, food, phone-call, and bathroom value is therefore
  unknown or absent from a KC3 verification perspective.
- Names reach 53 characters and addresses include long intersection forms,
  suite/floor information, area-only locations, leading punctuation, and at
  least one malformed-looking provider value.
- The schedule set includes closed days, split daily intervals, overnight
  closing, and 24-hour schedules encoded as midnight-to-midnight next-day
  intervals.
- Some records are independently useful sub-places inside a host, such as a
  cafe at a library or a business at Lenexa Public Market. KC3 does not yet have
  a parent-place relationship and must not silently merge them into the host.

The UI must therefore work well when every KC3-specific detail is unverified. It
must not fill the resulting space with negative claims, inferred amenities, or
provider ratings that answer a different question.

## Experience model

### List and discovery

The default result is the active-place list ordered by name, then stable KC3 ID.
Name search remains case-insensitive and whitespace-tolerant. All active filters
combine with AND behavior, and local filter changes must not require another
database request after a successful list load. The result count is visible and
announced after a search or filter change.

Search remains place-name search in this slice. The initial city and place-type
filters remain. The richer filter set adds:

- Open now;
- Good for work;
- Wi-Fi available;
- Outlets available;
- Food or drinks available;
- Phone calls okay;
- Bathroom available;
- Drive-thru available; and
- Hide drive-thru-only places, selected by default.

Unknown values never satisfy a positive filter. `none` and verified `false`
values also do not satisfy one. Food matches `light` or `full`; outlets match
`few` or `many`; Wi-Fi matches any known value other than `none`; and Good for
work matches only `good`. Stale KC3 details may still match but must carry their
stale warning. A stale or unavailable schedule never matches Open now.

The default exclusion of verified drive-thru-only places reflects KC3's purpose:
such a location is not currently a place to stay. Users may turn that exclusion
off. An unknown drive-thru-only value is not excluded.

On mobile, name search and the result count remain immediately visible. A single
Filters control opens a full-height sheet or screen containing grouped city,
type, and attribute filters, with Apply, Clear all, and Close actions. Changing
draft values in that surface does not alter the list until Apply. At 960 CSS
pixels or wider, Expo Web uses the same groups as a persistent left filter rail
beside the results; below that width it uses the mobile filter surface. The
values, labels, and behavior remain identical.

### List card

The entire card is one navigation target. It contains, in order:

1. full place name, allowed to wrap without ellipsis;
2. human-readable place type;
3. city and full canonical address, also allowed to wrap;
4. the usable regular-hours state; and
5. a compact KC3 summary.

The compact KC3 summary shows verified work suitability first when known, then
at most two positive highlights in this order: Wi-Fi, outlets, food/drinks. It
does not render every negative or unknown value. If no KC3-owned suitability
value is verified, it shows the single line `KC3 details not yet verified`.
Stale details add `KC3 details may have changed`. A verified drive-thru-only
warning is always shown above the compact summary and does not count toward the
three-item limit.

Cards do not contain secondary actions. Address navigation, full hours, all
amenity values, and provenance belong on the details screen. This preserves a
scannable 164-row list and avoids nested interactive targets.

### List to detail and back

Activating a card opens that place by stable KC3 place ID.

- Native uses a standard stack transition with a Back control labeled `Places`
  and supports the platform back gesture/button.
- Expo Web uses a distinct history entry so browser Back and Forward work.
- Returning restores the applied search/filter state, scroll position, and focus
  to the originating card. It does not reload or reset the list unnecessarily.
- Opening a detail URL directly and then going back leads to the place list.
- Opening details moves assistive-technology focus to the place-name heading.
- Wide Web remains a centered detail page in this slice; a master/detail split
  view is not required.

### Place-details hierarchy

The details screen uses this order:

1. **Identity and status** — name, type, city, address, regular-hours status,
   and any drive-thru-only warning.
2. **Primary actions** — `Open in Maps` from the address. This launches an
   external native map app or a new Web tab; it is not a KC3 map browsing
   surface. The visible address remains available as text and is not replaced
   by an icon-only control.
3. **Good to know** — work suitability, seating, outlets, Wi-Fi, food/drinks,
   phone-call suitability, bathroom, drive-thru availability, and the relevant
   KC3 verification state.
4. **Regular hours** — today's intervals first, then the complete Sunday-through-
   Saturday schedule, including split periods, closed days, overnight closing,
   and 24-hour days.
5. **About this information** — KC3 verification date and warnings, the regular-
   hours observation date, and the statement `Regular hours can change on
holidays or for special events.`

Internal verification notes, provider IDs, provider type arrays, raw timestamps,
coordinates, and source-specific storage names are never user-facing. The
details screen does not add ratings, rating counts, price level, website, or a
phone number in this slice. `Phone calls okay` describes whether calls are
suitable in the space; it is not contact information.

## Field-to-surface matrix

`Conditional` means the list card follows the compact-summary and state rules
above rather than rendering a full field row.

| Information                         | List card                              | Place details                        | Filter/search                       | Rule in this slice                                                                                     |
| ----------------------------------- | -------------------------------------- | ------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------ |
| KC3 place ID                        | No                                     | No                                   | No                                  | Navigation/data key only; never visible.                                                               |
| Name                                | Yes                                    | Yes                                  | Name search                         | Full canonical name; wrap, never truncate.                                                             |
| Place type                          | Yes                                    | Yes                                  | Yes                                 | Use the six approved human-readable labels.                                                            |
| City                                | Yes                                    | Yes                                  | Yes                                 | Only the three approved cities may be returned.                                                        |
| Address                             | Yes                                    | Yes + Open in Maps                   | No                                  | Full canonical value. Area-only values use `Approximate location` and must not imply a street address. |
| Address precision                   | Text qualifier only                    | Text qualifier only                  | No                                  | A structured summary value is required; do not infer precision from punctuation in the client.         |
| Regular open state                  | Yes                                    | Yes                                  | Open now                            | Based only on usable, fresh effective regular hours in the place timezone.                             |
| Full weekly hours                   | No                                     | Yes                                  | No                                  | Render intervals, closed days, overnight periods, and 24 hours without flattening them.                |
| Hours observation/freshness         | Warning only                           | Yes                                  | No                                  | Use the effective schedule's observation time, not a later provider fetch timestamp.                   |
| Work suitability                    | Conditional; always show a known value | Yes                                  | Good for work                       | `good`, `okay`, `poor`, or unknown language below.                                                     |
| Seating notes                       | No                                     | Yes                                  | No                                  | Free text is detail-only; absence never means no seating.                                              |
| Outlets                             | Conditional positive highlight         | Yes                                  | Available                           | `none`, `few`, `many`, or unknown.                                                                     |
| Wi-Fi                               | Conditional positive highlight         | Yes                                  | Available                           | Preserve public/password/none distinctions on detail.                                                  |
| Food and beverage                   | Conditional positive highlight         | Yes                                  | Available                           | `none`, `light`, `full`, or unknown.                                                                   |
| Phone-call suitability              | No                                     | Yes                                  | Calls okay                          | Nullable KC3-owned fact; not a phone number.                                                           |
| Bathroom                            | No                                     | Yes                                  | Available                           | Nullable KC3-owned public-bathroom fact.                                                               |
| Drive-thru available                | No                                     | Yes                                  | Available                           | Separate nullable KC3-owned fact. It does not imply drive-thru only.                                   |
| Drive-thru only                     | Warning when true                      | Warning and explanation              | Hidden by default; user may include | Separate nullable KC3-owned fact. `true` requires drive-thru available to be `true`.                   |
| KC3 verification date/freshness     | Summary/warning                        | Yes                                  | No                                  | Applies only to KC3-owned details; never derive it from provider refresh.                              |
| Google rating/count                 | No                                     | No                                   | No                                  | Not approved for this slice and not a workability substitute.                                          |
| Google price level                  | No                                     | No                                   | No                                  | Not approved; it is not KC3's food or cost-to-occupy classification.                                   |
| Website                             | No                                     | No                                   | No                                  | Deferred.                                                                                              |
| External map target                 | No                                     | Action only                          | No                                  | Build a safe query from canonical name/address; do not return or expose the stored provider URI.       |
| Provider IDs, types, fetch metadata | No                                     | No, except normalized freshness copy | No                                  | Internal/source data only.                                                                             |
| Verification notes                  | No                                     | No                                   | No                                  | Internal curation data.                                                                                |
| Coordinates and timezone            | No                                     | No                                   | No                                  | Internal inputs for map launch and local-time evaluation.                                              |
| Lifecycle status                    | No                                     | No                                   | No                                  | Only active places enter these anonymous surfaces.                                                     |

## Approved user-facing value language

### KC3-owned details

Known negative values must be as explicit as known positive values. Unknown is
never represented with a negative icon, a disabled-looking value, `No`, or an
empty space.

| Field/state                             | Approved copy                               |
| --------------------------------------- | ------------------------------------------- |
| Any missing detail row or unknown field | `Not yet KC3-verified`                      |
| Work `good`                             | `Good for working`                          |
| Work `okay`                             | `Okay for a short work session`             |
| Work `poor`                             | `Not suited for working`                    |
| Outlets `many`                          | `Many outlets`                              |
| Outlets `few`                           | `A few outlets`                             |
| Outlets `none`                          | `No outlets available`                      |
| Wi-Fi `public`                          | `Public Wi-Fi`                              |
| Wi-Fi `password_printed`                | `Wi-Fi · password posted`                   |
| Wi-Fi `password_on_request`             | `Wi-Fi · ask for password`                  |
| Wi-Fi `none`                            | `No public Wi-Fi`                           |
| Food `full`                             | `Full food menu`                            |
| Food `light`                            | `Drinks or light food`                      |
| Food `none`                             | `No food or drinks`                         |
| Phone calls `true`                      | `Phone calls okay`                          |
| Phone calls `false`                     | `Phone calls not suitable`                  |
| Bathroom `true`                         | `Public bathroom available`                 |
| Bathroom `false`                        | `No public bathroom`                        |
| Drive-thru available `true`             | `Drive-thru available`                      |
| Drive-thru available `false`            | `No drive-thru`                             |
| Drive-thru only `true`                  | `Drive-thru only · no place to stay inside` |
| Missing seating notes                   | `Seating not yet KC3-verified`              |

`drive_thru_available` and `drive_thru_only` must be separate nullable structured
values in KC3-30. A true drive-thru-only value requires drive-thru available to
also be true. A false drive-thru-only value does not prove indoor seating, so it
must not produce copy such as `Indoor seating available`.

### Unknown, unavailable, stale, and unverified

These states are not interchangeable:

| State                               | Meaning                                                                                                | Approved presentation                                                                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unknown/unverified KC3 value        | KC3 has not verified a yes, no, or classification. A missing detail row is normalized to this state.   | `Not yet KC3-verified`; the list collapses all-unknown details to `KC3 details not yet verified`.                                                          |
| Unavailable hours                   | No usable effective regular schedule exists.                                                           | `Hours unavailable`; do not show Open/Closed and do not match Open now.                                                                                    |
| Temporarily unavailable screen data | The anonymous summary/detail request failed or returned an unusable response.                          | `Places are unavailable` or `Place details are unavailable` plus `We couldn't load … right now. Please try again.` and a `Try again` action.               |
| Stale hours                         | The schedule observation is more than 14 full days old.                                                | `Hours may have changed · Last checked {date}`. Show the stored weekly schedule on detail, but suppress Open/Closed on cards and exclude it from Open now. |
| Stale KC3 details                   | `last_verified_at` is more than 180 calendar days before the place-local date.                         | `KC3 details may have changed · Last verified {date}`. Retain the values with this warning; never silently turn them into unknown or current facts.        |
| Current KC3 details                 | At least one KC3-owned value is known and the verification date is no more than 180 calendar days old. | `KC3-verified {date}` once per details section rather than on every value.                                                                                 |

The thresholds are display policy, not retention or refresh scheduling. Exactly
14-day-old hours and 180-day-old KC3 details remain current; they become stale
after those boundaries. Dates are formatted in the user's locale without a raw
timestamp.

## Regular-hours and open-state rules

The effective schedule uses the existing priority: active KC3 effective-dated
override, complete KC3-owned base schedule, Google schedule, then unavailable.
Open state is evaluated in the accepted IANA place timezone, not the device
timezone.

- `Open · until {time}` is shown when the current local time falls within a
  usable interval.
- `Closed · opens {time/day}` is shown when the next opening can be determined
  from the regular week.
- A full-day midnight-to-midnight next-day interval is `Open 24 hours`, not a
  zero-length or closed interval.
- Split periods render separately. The gap between them is closed, with the next
  interval used for reopening copy.
- An overnight interval remains open after midnight until its next-day close.
- An explicit closed day is `Closed` in the weekly table.
- With no usable schedule, missing timezone, invalid interval, or stale hours,
  the UI does not calculate or imply Open now.

The section heading is always `Regular hours`, never simply `Hours`, and the
special-hours disclaimer is always present. KC3 does not currently store live,
holiday, or special-event schedules.

## Loading, empty, error, and partial states

### Place list

- Initial load: `Finding places…` with a polite announcement. Visual skeletons
  may be used but are inert and hidden from the accessibility tree.
- Successful database-empty response: `No places yet` and `Check back soon as we
add more Lenexa, Overland Park, and Olathe third places.` Filters are not shown.
- Successful no-match response: `No matching places` and `Try changing or
clearing your search and filters.` Preserve the active controls and offer
  `Clear filters`.
- Request failure: `Places are unavailable`, the sanitized retry copy above,
  and `Try again`. Do not show provider, database, URL, or relation details.

### Place details

- Initial load: keep the Back control operable and show `Loading place
details…` with a polite announcement.
- If a cached list summary exists, keep the place name/type/address visible while
  detail-only content loads or retries.
- Request failure: `Place details are unavailable`, sanitized retry copy, `Try
again`, and the working Back control.
- Unknown ID, inactive place, or a place removed since the list loaded: `Place
unavailable` and `Back to places`; do not expose lifecycle status.
- Missing hours or KC3 details is a field/section state, not a whole-screen error.

A retry replaces the error with loading, ignores stale request completions, and
restores the recovered content without duplicating history entries.

## Mobile, Web, and accessibility contract

### Layout and reflow

- Mobile is one column. Content, filters, cards, and detail sections must remain
  reachable with the software keyboard open.
- At narrow widths, no field relies on horizontal scrolling. Long names,
  addresses, translations, and large text wrap naturally.
- Expo Web uses the same information hierarchy. At 960 CSS pixels or wider it
  uses a filter rail and result column; below that it uses the mobile filter
  surface. Reading and focus order remain logical in the DOM, and detail content
  stays at a readable line length.
- Support Dynamic Type and browser zoom/reflow without clipping at 200 percent.
  No name, address, state message, or primary action may be ellipsized.

### Semantics and operation

- Use one page-level heading, ordered section headings, list/list-item semantics,
  and description-list-like label/value semantics for details.
- A card is one link/navigation target with an accessible name containing the
  place name, type, city, usable hours state, and drive-thru-only warning when
  present. Do not announce every detail chip in the link name.
- Every interactive target is at least 44 by 44 layout units. State cannot be
  communicated by color alone.
- All controls work with touch, keyboard, switch control, and screen-reader
  activation. Visible keyboard focus must have at least the same prominence as
  pressed/selected state.
- Tab order follows visual order. Enter activates links/buttons; Space activates
  buttons; Escape closes the Web filter surface. A modal filter surface traps
  focus while open, has an accessible name, and restores focus to Filters when
  closed.
- Web provides a skip link from discovery controls to results when a persistent
  filter rail is present.
- Loading uses a polite live region; errors use an alert/assertive announcement;
  result-count changes use a concise polite announcement. Native iOS state
  changes require explicit announcements where live-region behavior is absent.
- On detail navigation, focus the place-name heading. On Back, restore focus to
  the originating card and retain scroll. Browser Back must behave the same way.
- Positive, negative, unknown, and stale states use meaningful text. Icons are
  optional decoration and never the only accessible label.

KC3-31 must include automated semantic/interaction coverage plus manual mobile
large-text, spoken screen-reader, Web keyboard, browser history, focus-return,
and narrow/wide responsive checks. Existing KC3-21 gaps are not silently closed
by this contract.

## Representative real-record walkthrough

These examples are from the KC3-28 local snapshot. They validate behavior; they
are not copied provider payloads and do not approve silent data corrections.

| Record                                                         | Case                                                                                                | Expected list behavior                                                                                   | Expected detail behavior                                                                                                |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Black Dog Coffeehouse — Lenexa                                 | Complete canonical/provider record and seven-day schedule; seed detail shell is entirely unverified | Normal wrapped card; current regular-hours state while schedule is fresh; `KC3 details not yet verified` | Identity/address and seven daily intervals; every KC3 field uses unverified language rather than guessed cafe amenities |
| Tomahawk Creek Tech Space — Overland Park                      | Partial provider record with no stored hours, rating, or rating count and no KC3 detail row         | `Hours unavailable`; no KC3 chips; still discoverable by city/type/name                                  | Missing hours and details remain local states; no whole-screen error and no inferred coworking amenities                |
| Clear Creek Wetlands (Future Site of Centennial Park) — Lenexa | 53-character name                                                                                   | Full name wraps to multiple lines; no ellipsis or fixed-height clipping                                  | Same full heading at large text; address and schedule remain readable                                                   |
| Plexpod Lenexa — Lenexa                                        | Split weekday schedule plus explicit weekend closed days                                            | Open/closed calculation respects the midday gaps while fresh                                             | Show both weekday intervals and `Closed` weekend rows; never merge the gap into one continuous day                      |
| Prairie Center — Olathe                                        | Friday/Saturday schedule closes at 12:30 AM next day                                                | Late-night Open state uses the prior day's interval                                                      | Render `8:00 AM–12:30 AM next day` with an accessible next-day qualifier                                                |
| Raven Ridge Park — Olathe                                      | Seven midnight-to-midnight next-day intervals and malformed-looking address punctuation             | Show `Open 24 hours` while fresh; wrap the stored address exactly                                        | Show 24 hours, not closed. Do not heuristically strip address characters; route data correction through curation        |
| Boba Tea — Overland Park                                       | Area-only address and no KC3 detail row                                                             | Prefix the address with `Approximate location`; keep the record searchable                               | Maps action may target the provider place, but visible copy must not imply a street address; details remain unverified  |
| Hermetheus Downtown Olathe Library — Olathe                    | Cafe sub-place inside a library context, no KC3 detail row                                          | Keep the independently returned cafe record and category                                                 | Do not merge it into the library or infer library amenities; a future parent-place model requires a separate decision   |

No current record can demonstrate a fully KC3-verified Good to know section.
KC3-31 must therefore test both the real all-unverified baseline and controlled
fixtures for current positive, current negative, partial, stale, and drive-thru
states.

## Requirements handed to KC3-30

KC3-30 may choose exact function and TypeScript names, but it must provide these
semantics without exposing base tables:

- a bounded anonymous active-place summary projection containing every value
  needed to render cards and apply all list filters locally;
- a bounded anonymous place-detail operation by stable KC3 place ID;
- normalized address precision rather than client punctuation heuristics;
- effective regular-hours intervals, place timezone, schedule observation time,
  and enough typed state to compute or safely return Open/Closed and its next
  transition;
- nullable/unknown-safe KC3 fields for seating, outlets, Wi-Fi, work, food,
  phone calls, bathroom, drive-thru available, and drive-thru only;
- separate hours and KC3 verification freshness values with the thresholds in
  this contract;
- canonical name/address values from which the client can construct a safe
  external map query without receiving a stored provider URI; and
- least-privilege function owners, active-only behavior, direct-table denial,
  exact-field response tests, malformed-response handling, and write denial.

Structured values and timestamps must cross the public boundary; preformatted
English status strings must not. Internal verification notes, Google identity,
raw Google fields, ratings, price, website, coordinates, and lifecycle fields
remain outside the public response except where a normalized, purpose-specific
value above requires them internally.

## Out of scope

- Database migrations, RPC changes, TypeScript model changes, or UI code.
- A KC3 map browsing surface, distance sorting, geolocation, or geographic
  expansion.
- Accounts, writes, crowdsourced submissions, moderation, or freshness reports.
- Holiday/live/special-event hours or unattended provider refresh scheduling.
- A parent/host-place model or heuristic correction of provider names,
  addresses, and classifications.
- Google ratings, price, website, phone number, or general-purpose provider
  metadata display.
- Closing KC3-21 or KC3-23 accessibility work.

## Validation result

The matrix, hierarchy, language, states, navigation, responsive behavior, and
accessibility expectations were walked against the real records above and the
164-place distribution. The contract stays within the current anonymous-read
and three-city MVP boundaries. KC3-30 can now define the expanded public data
contract, and KC3-31 can implement the UI, without deciding again which fields
belong on cards, details, filters, or nowhere in this slice.
