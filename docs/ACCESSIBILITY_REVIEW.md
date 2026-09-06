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
