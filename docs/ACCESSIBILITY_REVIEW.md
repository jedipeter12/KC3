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

- iOS: KC3 launched in Expo Go SDK 57 on iPhone 17 / iOS 26.5 using the fixture.
  The initial list and safe-area header rendered. Simulator taps failed with
  `AXError.cannotComplete`; Expo's introduction overlay prevented dependable
  interaction testing. A one-step preferred-text-size increase was restored.
  This is a launch check only; final fixes were exported but not rechecked natively.
- Verify native search, filters, scrolling with the keyboard open, and retry.
- Verify the full screen at large and accessibility Dynamic Type settings;
  heading wrapping is implemented but a complete large-text pass is pending.
- Listen to VoiceOver/TalkBack and Web screen-reader announcements, including
  loading, errors, retry, and selected filters. Automated announcement-call tests
  do not establish that spoken timing is correct.
- Android: no SDK/emulator or adb was available, so only bundle export passed.
- Live backend validation remains separate; Docker Desktop was stopped.

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
