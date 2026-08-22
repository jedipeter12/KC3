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

Find places that match selected needs and preferences. The exact search and
filter experience remains an MVP scope decision.

## MVP Scope

### Included

- A Supabase data foundation for individual places, Google-sourced metadata,
  KC3-specific place details, and weekly hours.
- The approved schema supports curated place records and preserves unknown detail
  values without requiring user accounts.
- Approval of this data foundation does not by itself approve every candidate
  client feature below.

### Explicitly Not Included

- No features have been permanently excluded. The later-feature candidates below
  are not approved for the MVP.

## Candidate MVP Client Features (Not Yet Approved)

The following client-facing ideas were discussed as a plausible MVP shape. They
are preserved for Product Owner review and must not be treated as implementation
tickets until approved. The place data model itself is approved separately below.

- A places database with search and filtering.
- Place list and place-detail views.
- Map and list presentation.
- Place categories or tags, hours, coordinates, and freshness timestamps.
- Attributes such as Wi-Fi, outlets, bathrooms, meeting or video-call
  suitability, and cost to occupy.
- Seed location data.
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
- Which candidate features are required for the first usable MVP?
- Is map presentation required for MVP, or is a list sufficient?
- Where will initial place data come from, and who is responsible for keeping it
  current?
- Does any approved MVP feature require user accounts?
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
