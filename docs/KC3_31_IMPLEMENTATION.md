# KC3-31 Place List and Detail Implementation

**Status:** UI and automated/Web verification complete; iOS large-text and Maps
handoff remediation verified in part; interactive native accessibility
verification remains open

**Date:** 2026-09-22

## Implemented behavior

The Expo client now uses `list_public_place_summaries()` for discovery and
`get_public_place_detail(uuid)` for a selected place. It retains the legacy
five-field operation only as a compatibility boundary.

- Cards present wrapped identity/address values, usable regular-hours state, a
  bounded KC3 summary, stale warnings, and the drive-thru-only warning.
- Name, city, type, Open now, work, Wi-Fi, outlets, food/drinks, phone-call,
  bathroom, and drive-thru filters use the approved AND and unknown-value rules.
  Verified drive-thru-only places remain hidden by default.
- Narrow layouts keep search and result count visible and use an isolated,
  Apply-based full-height filter surface. Expo Web at 960 CSS pixels and wider
  uses a persistent filter rail and a skip-to-results link.
- Details retain cached summary identity during loading/retry and render the
  approved identity, Open in Maps, Good to know, Regular hours, and About this
  information hierarchy. Unknown, negative, stale, unavailable, missing-place,
  and request-error states remain distinct.
- Stable-ID navigation preserves applied list state. Expo Web uses browser
  history and restores focus to the originating card; native uses the visible
  Places back action and hardware back handling.
- Request completions are guarded by request IDs. List and detail failures use
  stable sanitized copy and never render provider/database details.

## Minimal public-contract addition

The KC3-30 detail response did not contain enough information to identify the
place-local current weekday without exposing or guessing its timezone. Migration
`20260922010000_add_place_local_weekday.sql` adds only the nullable derived
`place_local_day_of_week` value. The constrained function owner, anonymous-only
execution, active-place behavior, and timezone exclusion remain unchanged.

## Verification record

Passing on 2026-09-22:

- `npm run test:app`: 77 tests across ten suites after the iOS follow-up.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, and
  `git diff --check`.
- Clean local `supabase db reset --local` through the KC3-31 migration.
- `npm test`: 228 pgTAP assertions across 11 files.
- `npm run lint:db`: no public-schema warnings.
- `npm run test:integration`: six live anonymous Data API tests, including exact
  summary/detail shapes and direct-table denial.
- `npm run export`: Web, iOS, and Android production bundles.

Manual Expo Web checks used the clean 15-place local seed:

- At the wide breakpoint, the filter rail, result count, trimmed mixed-case
  name search, detail hierarchy, distinct history entry, browser Back/Forward,
  detail-heading focus, and originating-card focus restoration passed.
- At 390 by 844 CSS pixels, the one-column list and full-height filter surface
  reflowed without visible horizontal clipping. The dialog isolated background
  content from the accessibility tree, Escape closed it, and focus returned to
  Filters.

The 2026-09-22 iOS follow-up used Expo Go 57.0.9 on an iPhone 17 simulator with
iOS 26.5 and the same clean 15-place seed:

- The default and largest standard text-size list views rendered without
  horizontal overflow; controls and cards expanded vertically.
- The maximum accessibility category exposed clipped native glyphs because
  React Native scaled rendered fonts without consistently scaling the Yoga text
  boxes. KC3 text and text-input primitives now apply the complete iOS font
  scale to both `fontSize` and explicit `lineHeight` during layout while leaving
  Web scaling to the browser. A 3.1× regression test protects the calculation.
- The previous Google Maps URL opened Safari and a Google interstitial when the
  native Google Maps app was absent. iOS now receives an Apple Maps query URL;
  the simulator opened native Maps. Web and Android retain the provider-neutral
  Google Maps search URL.
- `npm run test:app`, typecheck, lint, format-check, `git diff --check`, and a
  Web/iOS/Android production export passed after these fixes.

The simulator's first-launch Maps prompts and Device Hub's inaccessible UI
prevented a final post-fix maximum-size screenshot and dependable KC3 taps. The
macOS session was subsequently unlocked, but both the native automation bridge
and direct Device Hub/Xcode attachment timed out; command-line accessibility
control was not authorized by macOS. No search, filter, software-keyboard,
detail/back, or retry interaction pass is claimed from this attempt. VoiceOver
and spoken-announcement testing was explicitly deferred until the user can be
present to hear the Mac-routed simulator audio.

## Remaining verification

KC3-31 is not closed until an accessible interactive native environment records:

- default, large, and largest accessibility text sizes without clipping or
  unreachable controls;
- VoiceOver and/or TalkBack reading order, selected states, announcements,
  detail-heading focus, filter focus containment, and return focus;
- software-keyboard interaction, scrolling, native back gesture/button, Open in
  Maps handoff, and retry behavior; and
- a practical iOS pass and Android pass when tooling is available.

The two defects discovered in the partial iOS pass were corrected. The remaining
gaps are verification work, not evidence that the corrected behavior passed.
