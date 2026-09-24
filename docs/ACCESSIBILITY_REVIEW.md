# Accessibility and Responsive Review

Date: 2026-09-06. Ticket: KC3-21. Status: In progress.

## Verified

The Expo Web development client was exercised in the Codex browser at 1280×800,
320×568, and 390×844. A temporary localhost HTTP fixture served the 15 records
from `supabase/seed.sql` through the public RPC URL, plus controlled pending,
empty, and error responses. This verifies UI behavior, not live Supabase access.

- Desktop and narrow layouts: controls wrap, addresses remain readable, and
  controls/results share a scrollable area. At 390px the document scroll width
  equals the viewport width; no horizontal overflow was observed at 320px.
- Keyboard: Tab reaches search first; trimmed mixed-case `LiBrArY` search plus
  Enter on Olathe returns its two libraries. Space on Coffee shop produces the
  distinct no-match state. Shift+Tab reaches Clear filters; Enter restores the
  list. Error-state Tab/Enter on Try again recovers to an empty response.
- Accessible names: search and all filter/action controls have meaningful names.
  Selected Web filters now expose `aria-pressed`, verified in the DOM and native
  browser accessibility tree. Native selected semantics remain in place.
- Touch targets: measured search height 48px and filter height 44px at 390px.
  Clear filters was increased from 40 to 44 layout units; Retry remains 48.
- Loading exposes a polite live region. Error exposes an assertive alert with
  sanitized text and retry. Database-empty and no-match messages are distinct.
  Markup was inspected; spoken delivery is not yet verified.
- Placeholder contrast was improved. Computed text contrast ratios: placeholder
  6.13:1, selected button 6.42:1, address 6.03:1, and type badge 6.74:1.

## Fixes and Automated Checks

Web filter buttons now carry pressed state and rows carry list-item semantics.
iOS request changes call `AccessibilityInfo.announceForAccessibility`, because
native live regions are Android-only. The filter heading wraps, clear targets
are larger, and filter taps remain actionable with the mobile keyboard open.

Two regression tests protect Web state props and iOS loading/error/retry/success
announcements. All 30 application tests across six suites, typecheck, lint,
format-check, and Web/iOS/Android production exports passed. There is no selected
automated accessibility scanner; these focused tests are not a compliance audit.

References: [React Native accessibility](https://reactnative.dev/docs/accessibility)
and [WAI button semantics](https://www.w3.org/WAI/ARIA/apg/patterns/button/).

## Remaining Manual Checks

- Listen to VoiceOver and TalkBack reading order, selected states,
  announcements, detail-heading focus, modal containment, and return focus.
  Automated accessibility-tree and announcement-call checks do not establish
  that spoken timing or gesture navigation is correct. This work, including any
  remediation it uncovers, is tracked separately as KC3-34.
- Complete the remaining Web screen-reader announcement pass for KC3-21.

Practical iOS and Android search/filter/keyboard/detail/back/Maps/error-retry
checks and their large-text passes were completed on 2026-09-23. The historical
attempts and final evidence are recorded below.

Run the client with the documented public configuration and repeat these checks
on an interactive simulator/device before marking KC3-21 complete.

## Follow-up Attempt — 2026-09-06

Rechecked the merged implementation at `14cdc55`. All 30 application tests,
typecheck, lint, and formatting checks pass. No application behavior changed in
this follow-up, and production exports were not repeated.

The iPhone 17 / iOS 26.5 simulator screenshot still shows KC3 behind the Expo Go
developer menu. Its accessibility tree exposes only the simulator window and
toolbar, not the app controls. A coordinate tap on the menu's close button failed
with Computer Use error `-10005: noWindowsAvailable`; reconnecting to the simulator
and repeating the tap produced the same error. This does not establish a defect
in KC3, and no native interaction pass is claimed. Neither `adb` on PATH nor the
default macOS Android SDK directory is available.

### Manual Completion Procedure

Use an interactive device or simulator with the current client and the local
15-place seed. Record OS/device, client revision, text-size setting, screen
reader, observed result, and any defect for each check below.

1. At default text size, search for ` LiBrArY `, select Olathe, and verify the two
   Olathe libraries. Select Coffee shop and verify the no-match message. Clear
   filters and verify the complete list returns. Repeat filter taps while the
   software keyboard is open and scroll to the final place.
2. Repeat at a large text size and the largest accessibility text size. Inspect
   the header, search, every city/type chip, Clear filters, place names,
   addresses, and the bottom of the list for clipped text, horizontal overflow,
   or unreachable controls. Restore the original text setting afterward.
3. With VoiceOver (iOS), TalkBack (Android), or a Web screen reader, traverse the
   screen and verify meaningful control names, sensible reading/focus order,
   selected filter state, and operable search, filters, clearing, and retry.
4. Exercise a delayed response, failed response, retry success, and an empty
   response using a controlled local test backend. Listen for loading and error
   announcements; verify they are timely and intelligible. Inspect empty/error
   text and reach Retry at the largest text size. Do not equate accessibility
   markup or mocked announcement calls with a spoken verification pass.

Keep KC3-21 in progress until the remaining checks have recorded evidence.

## KC3-31 Expo Web Follow-up — 2026-09-22

The expanded summary/detail experience passed live anonymous-backend checks at a
wide Web viewport and at 390 by 844 CSS pixels. Verified behavior includes the
persistent filter rail, narrow full-height filter dialog, keyboard-operable
controls, isolated modal accessibility tree, Escape close, return focus to the
Filters trigger, visible focus treatment, result-count updates, detail-heading
focus, browser Back/Forward, and originating-card focus restoration. Long values
wrap and no horizontal clipping was visible in the narrow screenshot.

Automated coverage now protects approved richer-filter semantics, default
drive-thru-only exclusion, draft/apply behavior, cards, list/detail state
preservation, cached identity during detail failure, retry, and iOS announcement
calls. These checks still do not close either ticket's native spoken-screen-reader
or large-text requirements. The remaining KC3-31 procedure is recorded in
`KC3_31_IMPLEMENTATION.md`.

## KC3-31 iOS Follow-up — 2026-09-22

Expo Go 57.0.9 launched KC3 against the clean local seed on an iPhone 17 / iOS
26.5 simulator. Default and largest-standard text-size screenshots showed a
readable, wrapping list without horizontal overflow. At the maximum
accessibility category, native glyphs were clipped by text boxes that did not
track the rendered font scale. The shared native text primitives now scale both
font size and line height through layout at the full system multiplier; the
calculation is covered at 3.1×. Web text remains browser-controlled.

The practical Maps check also found that a Google Web search URL opened Safari
and an install interstitial when Google Maps was absent. The iOS action now uses
Apple Maps and was observed opening the native Maps app. App tests increased to
77 across ten suites, and typecheck, lint, formatting, diff-check, and all three
production exports passed after the fixes.

The Maps app then displayed first-launch permission prompts. After the macOS
session was unlocked, the native automation bridge still timed out attaching to
Device Hub and Xcode, and macOS denied command-line assistive access. The prompt
could not be dismissed through `simctl`, so the full post-fix maximum-size
screenshot and interactive search/filter/detail/back/retry checks remain
unclaimed. VoiceOver was deliberately deferred until the user can be present to
hear simulator speech routed through the Mac speakers. Restore an accessible
simulator UI session and complete the manual procedure above.

## KC3-31 Android Follow-up — 2026-09-23

A Pixel 9 Android 16 / API 36 Google APIs AVD ran Expo Go against the clean
15-place local seed through adb reverse tunnels. The default-size practical pass
verified trimmed mixed-case search, Olathe/Library selected states and two-result
output, the Coffee shop no-match state, clearing, keyboard-open filter entry,
scrolling to the final card, complete detail content, system Back, Maps handoff,
and sanitized failure/retry recovery.

The pass found and fixed two native defects. Returning from detail could restore
too early while FlatList had only measured an initial batch, clamping a saved
near-bottom offset. Restoration now waits for content sizing and initially
renders through the origin plus a bounded following buffer. Open in Maps also
crashed when `Linking.openURL` was used as an unbound default callback; a wrapper
preserves its React Native method context, and the component regression check
now exercises the action. Google Maps opened the requested Sar-Ko-Par Trails
Park result after the fix.

At Android font scales 1.3 and 2.0, app text wrapped without observed clipping or
horizontal overflow. Every filter was reachable in the scrolling modal, the
fixed Clear/Apply footer remained usable, detail content reached its final
disclosure, and the 2.0-scale error and Try again state remained readable and
operable. Restoring the local API tunnel and retrying returned all 15 places.
The emulator was restored to font scale 1.0. Expo Go's floating developer-tool
label clipped at large sizes; that overlay is not KC3 UI.

Spoken TalkBack behavior, announcements, accessibility focus movement, and
filter-modal containment have not yet been claimed. The user-attended VoiceOver
pass also remains open.

## KC3-31 Completed iOS Practical Pass — 2026-09-23

Meta idb attached to the iPhone 17 / iOS 26.5 simulator after direct Device Hub
attachment continued to time out. Against the clean 15-place seed, trimmed
mixed-case search returned six libraries; Olathe and Library exposed native
selected traits and the expected two results; Coffee shop plus the library query
produced the no-match heading; and Clear filters restored all places. The filter
surface opened with the software keyboard active and isolated the background
accessibility subtree.

The final list card opened the complete detail hierarchy. The visible native
Back action restored that near-bottom origin. Apple Maps resolved Sweet Tee's
Coffee Shop, and returning to Expo Go preserved the detail. Stopping the local
API gateway produced the sanitized unavailable heading and reachable Try again
control; retry succeeded once the gateway was healthy.

At the maximum accessibility Dynamic Type category, list and detail content
remained vertically scrollable and wrapped without horizontal clipping. The
pass found that the filter title and Close action overlapped and the native
modal lacked a safe-area inset. The header now wraps and the native modal applies
the app-provided safe-area insets. Post-fix accessibility frames and screenshots
showed separate, reachable title/Close rows below the status area, scrollable
filter choices, and reachable Clear/Apply actions. The simulator was restored to
the standard Large category. Spoken VoiceOver behavior is intentionally not
claimed until the user is present to hear the simulator audio.
