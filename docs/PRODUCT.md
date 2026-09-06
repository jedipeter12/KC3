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
place list.

## MVP Scope

### Included

- A Supabase data foundation for individual places, Google-sourced metadata,
  KC3-specific place details, and weekly hours.
- The approved schema supports curated place records and preserves unknown detail
  values without requiring user accounts.
- An initial local-development seed of 15 real places across Lenexa, Overland
  Park, and Olathe, using only verified canonical names and addresses while
  leaving unverified details, Google metadata, and hours unknown.
- Anonymous, read-only discovery of active places through an approved public
  projection containing only place ID, name, city, address, and place type.
- The approved public discovery boundary does not require accounts and does not
  permit client writes or direct access to the underlying place tables.
- A list-first Expo client slice that shows the public projection, supports
  client-side name search and city/place-type filters, and handles loading,
  empty, and error states.
- The first client slice targets mobile and Expo Web and does not require a map,
  accounts, writes, hours, or a place-detail screen.

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
Baseline verification is ongoing; native large-text and spoken screen-reader
checks remain outstanding in `docs/ACCESSIBILITY_REVIEW.md`.

## Later Client Feature Candidates (Not Yet Approved)

The following client-facing ideas were discussed as a plausible MVP shape. They
are preserved for Product Owner review and must not be treated as implementation
tickets until approved. The place data model itself is approved separately below.

- Place-detail views.
- Map presentation.
- Place categories or tags, hours, coordinates, and freshness timestamps.
- Attributes such as Wi-Fi, outlets, bathrooms, meeting or video-call
  suitability, and cost to occupy.
- A mobile-friendly layout and deployment.

## Approved MVP Data Model

The approved MVP schema uses an individual physical place as its canonical record
and separates data by ownership and purpose:

- `places` stores the canonical name, city, address, place type, optional unique
  Google Place ID, and lifecycle status.
- `place_google_data` stores optional Google-derived attributes and raw source data
  separately from KC3-owned details.
- `place_details` stores seating notes, outlets, Wi-Fi, work suitability, food and
  beverage level, nullable verified/unknown booleans, and verification metadata.
- `place_hours` stores zero or more intervals per place and day, including closed
  days, overnight closing, source, and verification metadata.

Approved place types are coffee shop, cafe, boba/tea, library, coworking, and park.
Approved place statuses are active, temporarily closed, permanently closed, and
hidden. Detail classifications include explicit `unknown` values where specified;
nullable booleans use `true` for verified yes, `false` for verified no, and `null`
for unknown.

Hours use `0` for Sunday through `6` for Saturday. Multiple rows per place and day
are allowed so split operating periods can be represented.

## User Experience Principles

- No principles have been approved yet.

## Business / Product Constraints

- Budget: Not documented.
- Platform: React Native with Expo, initially targeting mobile and Expo Web.
- Privacy: Not documented.
- Accessibility: Not documented.
- Other: Keep the MVP boundary clear and deliver work in small, reviewable
  tickets.

## Open Product Questions

- Should KC3 consistently call these locations "third places" or "third spaces"?
  The source context uses "third place," while the original repository summary
  used "third space."
- Which capabilities, if any, should follow the approved list-first slice?
- When, if ever, should map presentation enter the MVP?
- Where will initial place data come from, and who is responsible for keeping it
  current?
- Do any future candidate MVP features require user accounts?
- What are the initial geographic boundaries of the Kansas City metro for KC3?
- What privacy and accessibility requirements must the MVP meet?

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
