# KC3-36 Provider Content and Launch Rights Audit

**Audit date / source access date:** 2026-10-02 (America/Chicago)

**Ticket:** [Audit Google Maps/Places launch data rights and attribution](https://app.notion.com/3e635ab73db38135a8ffda82a7cb393c)

**Result:** Audit complete; the current provider-backed implementation is not
cleared for production. KC3-37 must resolve the findings before KC3-39 deploys
the production backend or App Store content-rights declarations are finalized.
This audit does not implement remediation or select a new data-source strategy.

## Identity and evidence boundary

The Notion database's actual item 36 is this rights audit. Earlier repository
work used “KC3-36” for canonical corrections, including
`KC3_36_CORRECTIONS.md`. That historical file records real completed work; it
does not close the board's rights ticket. Future references should include the
ticket title or this document's filename to distinguish them.

Reviewed repository baseline: `e414806`, plus the existing uncommitted native
accessibility changes. No runtime, schema, credential, or dataset change was made
for this audit. Repository paths below describe supported code paths, not a
measurement of a hosted database. Google billing region, accepted account
agreement, negotiated permissions, hosted inventory, backups, and console
settings were not available in the reviewed evidence. No live Places requests
were necessary.

## Current authoritative rules

These are the published rules, followed by KC3 engineering findings. They do not
establish account-specific authorization.

- **G1 — General terms:** Sections 3.2.2(a–b) and 3.2.3(a–e) address
  disclosures/attribution, extraction and caching, derived content, directory
  use, and non-Google maps. The examples explicitly include saving business
  names/addresses, directory services, and text-to-speech. KC3 must resolve the
  directory-use and native accessibility interpretation, rather than assume
  suitability features create an exception. [Google Maps Platform Terms](https://cloud.google.com/maps-platform/terms)
  (page identifies August 26, 2026 as its last modification).
- **G2 — Applicable narrow exceptions:** A.3 permits documented ID caching;
  B.14 allows Places without a map, prohibits its use with a non-Google map,
  and permits latitude/longitude caching for at most 30 consecutive calendar
  days, followed by deletion. This is not a general 30-day allowance for every
  Places field. [Current non-EEA Service Specific Terms](https://cloud.google.com/maps-platform/terms/maps-service-terms).
- **G3 — Display:** Use Google Maps attribution, preferably the official logo;
  text is permitted when space is limited. Place it visibly with the relevant
  content and distinguish other sources. Logo: 16–19dp high, clear space
  10dp left/right/top and 5dp below, accessible “Google Maps” label. Text:
  12–16sp, weight 400, approved contrast/colors, unchanged capitalization and
  no wrapping. Preserve supplied third-party attribution. Photos/reviews have
  additional author/source requirements. [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies)
  (updated September 28, 2026).
- **G4 — Identifiers:** Place IDs may be stored indefinitely; Google recommends
  refreshing IDs older than 12 months. That recommendation is not an expiry
  exemption for associated data. [Place ID guide](https://developers.google.com/maps/documentation/places/web-service/place-id).
- **G5 — Response metadata:** `Place.attributions` carries data-provider
  attribution that must accompany the result. [Place resource](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places).
- **A1 — Apple:** App Store Connect Content Rights covers third-party content
  contained, shown, or accessed, with necessary rights in each distribution
  region. [App information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information).
  Guidelines 5.2.1–5.2.2 require permission, including service-term compliance,
  and authorization on request. Guideline 5.1.1 requires an accessible in-app
  privacy policy and metadata link. [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).
  Privacy answers must include relevant partners and actual data practices.
  [Manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/).

**Regional applicability remains a launch prerequisite.** Kansas locations do
not establish the Google customer's billing region. The
[EEA terms](https://cloud.google.com/terms/maps-platform/eea) depend on billing
address and include a pre-July-8-2025 unmodified-integration provision. EEA
[Service Specific Terms B.15](https://cloud.google.com/terms/maps-platform/eea/maps-service-terms)
restrict most Places content from use with any map, including linked maps, and
refer to separate permitted uses; coordinates and IDs have distinct treatment.
Confirm the governing agreement before choosing a production design. Neither
regional branch supplies evidence for KC3's current indefinite content store.

## Implemented data flow and retention

1. `scripts/import-google-places.ts` calls
   `src/ingestion/googlePlacesProvider.ts`: Text Search (New) requests
   `places.id,nextPageToken`; Place Details (New) uses the exact mask in
   `src/ingestion/googleContract.ts`. Queries are bounded by city/category,
   pages, and place count. Bounded API access still requires applicable rights.
2. `googlePlaceIngestion.ts` validates and normalizes details, chooses canonical
   initial values, extracts city, plans status/coordinate changes, and converts
   weekly periods. `googleImportRunner.ts` keeps raw responses in process memory;
   dry-run still fetches details and prints bounded name/address review text.
3. `googleImportRepository.ts` calls `kc3_google_import_state` and
   `kc3_reconcile_google_place`. Migrations `20260908000000` and
   `20260920000000` atomically persist canonical/provider values and Google
   schedules, including attaching provider content to seed identities.
4. Migration `20260922000000` derives address precision, resolves override →
   KC3 schedule → Google schedule, and computes open/closed state, next
   transition, and observation date. Public list/summary/detail RPCs distribute
   resulting identity and schedule values. The 14-day stale-hours rule suppresses
   confident current state; it does not delete the stored week or hide every
   provider-derived field. Public responses omit the effective source and
   third-party attributions.
5. `PlaceListScreen.tsx` and `PlaceDetailScreen.tsx` display identity, hours, and
   KC3 suitability, with state held in memory. The detail fallback uses the
   already-loaded summary. `placePresentation.ts` builds a name/address query;
   detail uses Apple Maps on iOS and Google Maps on Android/Web. Public types do
   not expose the provider Maps URI or Place ID for that action.
6. Internal detail/canonical operators display provider identity context.
   Canonical corrections append complete before/after snapshots, even for
   unchanged fields, in `place_canonical_corrections`. Old Google-derived
   name/address text can therefore survive a later sourced correction.

There is no implemented retention expiry/purge, field-level canonical source
ledger, or third-party attribution transport. Missing fields preserve previous
values; failed refreshes preserve all prior data. `google_fetched_at` does not
prove that every retained field was present in that response. Client state has
no persistent offline cache identified in the reviewed source. Database access
control and atomic writes protect integrity, not content rights.

## Field-by-field launch disposition

Disposition codes specify the remediation target, not permission to continue
the current storage path: **K** = keep KC3/independent data with provenance;
**I** = source independently before durable use; **L** = optional request-time
Google display only after all agreement/use gates; **E** = narrow exception with
enforcement; **R** = remove unnecessary provider copy. All L entries are
conditional on resolving the directory and regional questions. An independent
source must have its own permitted-use basis; a Google value renamed “canonical”
or marked verified is not independent evidence.

| Input / source | Current persistence and use | Launch disposition |
| --- | --- | --- |
| `id` | `places.google_place_id`; import matching, reconciliation, operator identity | **E:** retain ID under G4; track ID refresh separately |
| `displayName.text` | `place_google_data.google_name`; initializes/cosmetically refreshes `places.name`; all public identities, search, speech, Maps query, operator display, correction history | **I** canonical name; **L** optional provider name; **R** durable provider/history copies without authorization |
| `formattedAddress` | `google_address`; initializes/refreshes `places.address`; cards/details, Maps query, duplicate review, correction history | **I** canonical address; **L** optional provider address; **R** unauthorized provider/history copies |
| `addressComponents` | `google_address_components` JSONB; city extraction and address-precision trigger | **I** city/precision evidence; **R** durable Google components |
| Derived city | `places.city`; city-bound selection, discovery filters, public display | **I** independently establish municipality; operator-requested city alone is not evidence for a returned record |
| Derived precision | `places.address_precision`; approximate-address copy and operator correction snapshots | **I/K** with field evidence; reassess values initialized by Google components |
| `location.latitude` | `google_latitude` plus `places.latitude`; movement and duplicate checks; not public | **E** only with field expiry/deletion within G2; **I** if permanent coordinates needed; **R** unused copy |
| `location.longitude` | `google_longitude` plus `places.longitude`; same consumers | Same disposition as latitude; purge both copies and dependent caches together |
| `timeZone.id` | `google_time_zone` plus `places.time_zone`; local weekday, override dates, hours state | **I** licensed timezone source; **R** durable provider timezone; no coordinate-exception extension |
| `businessStatus` | `google_business_status`; may set `places.status`; active-only RPC eligibility | **I** lifecycle evidence; **L** optional provider state; **R** durable Google copy; preserve KC3 `hidden` decisions |
| `primaryType` | `google_primary_type`; internal operator context | **R** unused durable provider type; **L** only if approved purpose |
| `types` | `google_types`; internal operator context | **R/L** as primary type |
| Operator category / normalized type | `places.place_type`; new imports receive queried category, refresh preserves it; public label/filters | **K** classification scheme; **I** validate each assignment independently of search membership |
| `regularOpeningHours.periods` | Normalized `place_hours`, `source='google'`, including split/overnight/closed-day expansion; list/detail schedule | **I** durable week; **L** optional live week; **R** unauthorized normalized Google rows |
| Derived hours state/transition/local weekday | RPC computation from effective week and canonical timezone; UI status and open filter | **K** computation code; **I** permitted inputs or **L** request-bound result; not a standalone storage exception |
| `movedPlaceId` | `google_moved_place_id`; relationship resolution deferred | **E** identifier only under ID policy; **I** independently establish move relationship; **R** unnecessary metadata |
| Move relationship | `places.moved_to_place_id`; canonical model exists, two-listing writer deferred | **K/I** separately evidenced relationship; ID retention alone does not establish a move |
| `googleMapsUri` | `google_maps_uri`; internal provider storage, not current Maps action | **L** optional current provider link; **R** durable URI copy; approved ID-based Google URL is a separate implementation option |
| `rating` | `google_rating`; no public consumer | **R** omit request/storage; **L** only if future approved feature |
| `userRatingCount` | `google_user_rating_count`; no public consumer | **R/L** as rating |
| `websiteUri` | `google_website_uri`; no public consumer | **R** Google copy; **I** for durable business-owned link; **L** only if needed |
| `priceLevel` | `google_price_level`; no public consumer, distinct from KC3 food suitability | **R** omit request/storage; **L** only if future approved feature |
| Fetch/source metadata | `google_fetched_at`, Google `place_hours.source_observed_at`; provider freshness/operator context and public hours check date | **K** KC3-generated request/observation metadata without embedded content; add per-field expiry if using E; not rights evidence |
| Database audit metadata | UUIDs, `created_at`, `updated_at`, row FKs | **K** KC3-generated metadata; timestamps do not authorize associated payload |
| Canonical correction evidence | `before_values`, `after_values`, HTTPS source/date/notes; complete snapshots can retain Google text | **K** independently supported facts/evidence; **R** unauthorized historical provider text through reviewed migration; retain audit integrity |
| KC3 suitability | `place_details`: seating, outlets, Wi-Fi, work, food, calls, bathroom, drive-thru, verification date/notes | **K** independent observations; current operator requires Google-backed identity, so eligibility must support chosen sourcing strategy |
| KC3 hours / overrides | `place_hours source='kc3'`, `place_overrides.override_value`, dates/notes/observation time | **K** independently observed/licensed data; copying a Google week into these rows does not establish provenance |
| `attributions` (not requested) | No normalizer, column, public type, or UI transport | **L** retrieve and carry G5 metadata alongside any approved live result; render required links/names |
| Search `nextPageToken` / response envelopes | Process memory only; no database field | Request-bound use; no durable cache; avoid payload logging |
| Raw/phone/photos/reviews/AI summaries/current or special hours/atmosphere | Raw and phone columns removed by `20260907000000`; other fields omitted from mask | **R** keep excluded; future addition requires its own rights/display audit |

The 15 seed identities have independently cited owner/municipal sources in
`SEED_DATA.md`; that is useful provenance, not blanket clearance for subsequent
Google enrichment or every source site's content. The three park corrections
have narrower independent evidence. Unchanged fields in their full snapshots
still require individual review.

## Release blockers and concrete remediation

| Finding | Repository evidence / consequence | KC3-37 work and closure evidence |
| --- | --- | --- |
| B1: Indefinite provider persistence and derivative canonical copies | Importer, missing-value preservation, Google hours, canonical initialization and audit snapshots; G1/G2 exception mismatch | Inventory actual target rows and secondary copies; choose source path; migrate or remove unsupported values; prove backups/logs/history cannot restore them; preserve KC3 UUIDs/enrichment |
| B2: Directory/use authorization unresolved | Product is a third-place directory with KC3 suitability; G1 includes directory restriction | Obtain applicable written authorization/contract basis or remove dependence on restricted service; live fetching and substantial added value alone do not close this gate |
| B3: Attribution/provenance missing | List/detail show mixed values, generic last-checked text; no `attributions` transport | Add field/effective-source metadata and G3/G5 display on every applicable surface, including loading fallback and internal displays; verify Web/native/large text/screen readers |
| B4: Provider-derived Apple Maps action | `buildMapsUrl`, detail platform branch; G2 and regional conditions | Route approved Google content consistently with governing terms, or use independently sourced destination facts; verify each platform and fallback |
| B5: Native speech interpretation unresolved | Accessible card names and hours are exposed to VoiceOver/TalkBack; G1 text-to-speech example | Secure applicable accessibility interpretation or use independently sourced spoken content; do not disable accessibility as a workaround |
| B6: Account basis and submission evidence incomplete | Billing/contract not established; no production policy URLs or content-rights evidence in reviewed implementation | Verify account/region, publish accurate policies, reconcile actual app/partner flows, prepare rights evidence before final Apple responses |

**Choice A — Independently sourced durable directory:** Establish identity,
municipality, classification, coordinates/timezone, lifecycle, and schedules
from direct observation, owner-supplied records, or another explicitly licensed
dataset. Record field-level source/date/permission evidence. Preserve existing
KC3 enrichment. Google may be omitted or added later as a separately reviewed
integration. This matches the durable anonymous-directory design but requires
coverage/maintenance work and review of each alternate source's rights.

**Choice B — Conditional live Places integration:** Retain permitted IDs and
KC3 observations, make bounded request-time lookups through a trusted server,
and separate the live provider presentation from independent facts. Implement
attribution, fail-to-unavailable behavior, and any coordinate expiry. Requires
resolution of B2/B5 and regional/account terms first; it is not yet a verified
compliant architecture. Evaluate provider availability, cost, changed discovery
semantics, and accessible mixed-source presentation before approval.

**Choice C — Explicit additional rights:** Obtain documented provider permission
covering this exact directory, storage, derivatives, display, navigation, speech,
and retention model. Configure implementation to that grant's limits. Payment,
API-key possession, field ownership labels, and a refresh job are insufficient
evidence on their own.

The Product Owner chooses the data-source/cost/scope strategy in KC3-37. None of
these choices replaces TypeScript, Expo, Supabase, or PostgreSQL. No deployment,
purge, migration, provider contact, or agreement acceptance is authorized by
this audit.

## Disclosures and App Store readiness

If Google content remains, publish accessible KC3 terms/privacy documents with
the applicable Google notices and links under G1/G3:
[Google Maps End User Additional Terms](https://maps.google.com/help/terms_maps/)
and [Google Privacy Policy](https://policies.google.com/privacy). Explain source
distinctions, external map handoff, service requests, and actual retention.
Review Supabase hosting logs and any future request-time Google proxy when
answering privacy questions; server-only keys do not establish that no user data
is collected. No accounts/geolocation feature is implemented, so do not invent
those flows in disclosures.

For A1, prepare a rights register: provider/account agreement and region,
independent field-source permissions, attribution screenshots, retention tests,
and exact submitted build/data version. The current app accesses third-party
content even when it omits ratings/reviews. Do not finalize a rights-confirmation
response until every launch path is supported; do not claim Google or Apple
endorsement. No App Store Connect answer or policy was published in this task.

## Verification and handoff

- The 16-field Details mask, two Search response paths, provider columns,
  canonical copies/derived fields, Google hours, public RPCs, operators,
  correction history, and client Maps/cache/speech paths were inspected.
- Current primary Google/Apple sources above were read on the audit date.
- No application or database behavior changed. TypeScript, ESLint, formatting,
  all 93 application tests (13 suites), Web/iOS/Android Expo exports using inert
  public placeholders, and `git diff --check` passed. Existing uncommitted
  accessibility work was preserved and was included in the checked tree.
- Runtime limitation: checks used the available Node 26.7.0 / npm 11.19.0;
  repository-pinned Node 24.20.0 was not installed. These results do not replace
  pinned-runtime CI. No database tests/reset were run because this audit changes
  neither schema nor persisted data.
- KC3-37 remains the implementation/decision gate. KC3-39 deployment and final
  content-rights/privacy closeout depend on that remediation. KC3-34's attended
  native accessibility gate remains independently open.
- Recheck sources and the actual provider agreement after selecting a strategy
  and against the final release. Audit completion is not production clearance.
