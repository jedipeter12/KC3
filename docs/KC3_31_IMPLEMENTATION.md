# KC3-31 Place List and Detail Implementation

**Status:** Implementation and scoped verification complete; user-attended
VoiceOver and TalkBack verification transferred to KC3-34

**Date:** 2026-09-23

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

The 2026-09-23 Android pass used a Pixel 9 AVD running Android 16 / API 36 with
Google APIs. Expo Go reached the local Expo and Supabase services through adb
reverse tunnels.

- Trimmed mixed-case ` LiBrArY ` search returned six places. Olathe plus Library
  returned the two expected libraries; changing type to Coffee shop produced the
  distinct no-match state, and Clear filters restored all 15 places.
- The filter sheet remained operable while the software keyboard was open,
  closed the keyboard on presentation, and exposed selected state for the chosen
  city and type. The list scrolled to its final card and detail content scrolled
  through Good to know, Regular hours, and About this information.
- A practical system-Back check found that the remounted virtualized list could
  clamp the saved offset before enough content existed. The return path now
  renders through the origin plus a small following buffer and restores the
  saved offset only after content layout. Repeated device checks returned to the
  originating near-bottom card.
- Open in Maps initially crashed because passing `Linking.openURL` as an
  unbound default callback lost React Native's method context. A
  context-preserving wrapper and regression assertion now protect the handoff.
  Google Maps opened the
  requested Sar-Ko-Par Trails Park result, and returning to KC3 retained the
  originating list context.
- At Android font scales 1.3 and 2.0, list cards, the complete scrolling filter
  sheet, fixed Clear/Apply actions, detail content, and final disclosure wrapped
  without app-text clipping or unreachable controls. At 2.0, the sanitized
  failure state and Try again remained usable; restoring the Supabase tunnel and
  retrying returned all 15 places. The emulator font scale was restored to 1.0.
- After the Android fixes, all 77 application tests, typecheck, lint,
  format-check, `git diff --check`, and Web/iOS/Android production export passed.

The completed 2026-09-23 iOS pass used Meta idb against the same iPhone 17 / iOS
26.5 simulator after direct Device Hub attachment continued to time out:

- Trimmed mixed-case search returned six libraries. Olathe plus Library exposed
  native selected traits and the two expected results; Coffee shop plus the
  library query produced the distinct no-match heading, and Clear filters
  restored all 15 places.
- The filter surface opened while the software keyboard was active, hid the
  background accessibility subtree, and exposed its controls in logical order.
- The final card opened its complete detail hierarchy. The visible native Back
  action restored the originating near-bottom card, and Apple Maps opened the
  correct Sweet Tee's Coffee Shop result before KC3 resumed on the same detail.
- Stopping the local API gateway produced the sanitized unavailable heading and
  Try again control. After the gateway was healthy, retry restored all 15
  places.
- The maximum iOS accessibility text category exposed a filter-header overlap
  and missing modal safe-area inset. The header now wraps, and the native modal
  applies the app-provided safe-area insets. A post-fix simulator pass confirmed
  separate, reachable Filters and Close controls, scrollable choices, and
  reachable Clear/Apply actions. The simulator was restored to the standard
  Large setting.
- After the completed iOS fixes, all 77 application tests, typecheck, lint,
  format-check, `git diff --check`, and Web/iOS/Android production export passed.

## Transferred follow-up

KC3-34 now owns the remaining native spoken-screen-reader work:

- VoiceOver and TalkBack reading order, selected states, announcements,
  detail-heading focus, filter focus containment, and return focus;
- any implementation changes or regression coverage required by defects found
  during those user-attended passes; and
- final spoken-verification evidence for the KC3-21/KC3-23 closeout gate.

The defects discovered in the practical iOS and Android passes were corrected
and rechecked. Splitting the spoken work does not remove it from the MVP release
gate; it prevents device-attended verification from obscuring KC3-31's completed
implementation and practical native evidence.
