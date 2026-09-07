# List-first MVP Verification

Ticket: KC3-23. Date: 2026-09-06 (America/Chicago).
Status: In progress; milestone closure blocked by KC3-21 and live mobile smoke.
Application revision: `278f0b1`. This verification changes documentation only.

## Acceptance Evidence

| Requirement | Result and evidence |
| --- | --- |
| Seeded active places load through anonymous RPC on Web and mobile | Web passed against the reset local Supabase backend at `http://localhost:8083`; all 15 seed records appeared. Mobile remains unverified. |
| Approved search and city/type filters | Automated coverage passes. Live Web search ` LiBrArY ` plus Olathe returned Olathe Downtown Library and Olathe Indian Creek Library. Coffee shop produced no matches; Clear filters restored the unfiltered list. |
| Loading, empty, no-match, error, retry | Component tests passed for every state. Live Web no-match and clearing passed. Controlled Web loading/empty/error/retry evidence is retained in the KC3-21 review; those controlled browser scenarios were not repeated in this pass. |
| Bounded product scope | Source inspection found only the approved list, four displayed fields, local filters, and request states. The data layer calls only `list_public_places`; no map, account, write, hours, Google metadata, or details feature was introduced. Existing tests protect exclusion of unapproved runtime fields. |
| Application and database checks | All commands below passed. |
| Documentation and tracker agree | KC3-14 through KC3-20 and KC3-22 are Done/Completed. KC3-21 remains In progress/In Progress. KC3-23 is In progress/In Progress with the remaining gate recorded. |

## Commands and Results

Final checks used Node 24.20.0, npm 11.19.0, the existing lockfile and installed
dependencies, and Supabase CLI 2.115.0. An initial application-only pass also
succeeded under the shell's Node 26.7.0 default; the final pass used the pin.

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run format:check`: passed.
- `npm run test:app`: 30 tests across six suites passed.
- `npm run export`: Web, iOS, and Android exports passed with inert public
  placeholder configuration. These are bundle checks, not signed native builds.
- `npm exec -- supabase db reset --local`: both migrations and seed applied.
- `npm test`: 120 pgTAP assertions across six files passed.
- `npm run lint:db`: no schema errors or warnings.
- `npm run test:integration`: three live tests passed, including all 15 seed IDs,
  exact raw five-field serialization, production data-layer results, and HTTP
  401 / PostgreSQL `42501` denial for anonymous direct table reads.

The Web smoke server used the local API URL and anonymous key captured from CLI
status without printing credentials. No hosted backend or privileged client key
was used. No product, architecture, schema, seed, or dependency change was needed.

## Remaining Closeout Gate

The iPhone 17 / iOS 26.5 simulator still shows KC3 behind the Expo Go developer
menu. Its accessibility tree contains only the simulator window/toolbar. A
coordinate tap on the visible close control returned Computer Use error
`-10005: noWindowsAvailable`. The displayed session does not establish that the
current application loads from live Supabase on mobile.

Complete the [KC3-21 manual procedure](ACCESSIBILITY_REVIEW.md#manual-completion-procedure)
on an interactive device or simulator: native search/filter/clear/retry and
keyboard-open scrolling, large and accessibility text sizes, and spoken
screen-reader checks. Also record a current mobile launch and interaction pass
against the local seeded anonymous RPC. Record device/OS, revision, configuration,
observed outcomes, and defects. Do not substitute exports or mocked announcement
tests for these checks.

After those checks pass, reconcile KC3-21 and KC3-23 with the roadmap and prepare
the bounded slice for Product Owner review. This report does not close the
milestone or approve deployment; the existing pre-launch requirements in
`SECURITY_REVIEW.md` remain applicable.
