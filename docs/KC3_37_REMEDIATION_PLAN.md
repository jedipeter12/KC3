# KC3-37 Remediation Plan

Started 2026-10-02 (America/Chicago). Status: preparation in progress; Product
Owner chose Overture; spreadsheet review and launch cutover remain open. Ticket:
[Resolve provider-content storage, provenance, and attribution for launch](https://app.notion.com/3e635ab73db38177bbf6f4c1e3ecb848).
Normative findings and field dispositions remain in
[`KC3_36_PROVIDER_CONTENT_AUDIT.md`](KC3_36_PROVIDER_CONTENT_AUDIT.md).

## Approved sourcing direction

The existing directory saves Google facts in Supabase and redistributes them
through canonical identity, hours, public RPCs, operator context, and correction
history. Refreshing data or adding attribution does not close all audit gates.
The Product Owner explicitly selected Overture as the starting source and
requested spreadsheet review with separate verification/missing flags. The
decision is recorded in `docs/DECISIONS.md`; review/import preparation and
remaining cutover work are described in [Overture Review](OVERTURE_REVIEW.md).
The table below records the alternatives considered before that selection.

| Path | Implementation direction | Prerequisite / tradeoff |
| --- | --- | --- |
| Independent durable directory (recommended for evaluation) | Establish permitted independent facts and field evidence; preserve stable IDs and KC3 details; retire unsupported provider copies | Requires source-permission review and ongoing curation; current coverage and hours cannot be promised |
| Conditional live Google | Trusted request-time lookups, separated source presentation, attribution, unavailable/error behavior, and bounded retention | Directory/speech and governing account permissions must be resolved first; costs, availability, and search semantics require approval |
| Additional Google rights | Adapt storage/display to a documented grant covering KC3's actual use | Requires account-owner/provider action; permission, price, and timing are unknown |

The Overture choice is approved; research thresholds are not publication rules.
A publicly readable business or municipal page
does not automatically establish permitted reuse. Independently sourced facts
may match Google, but matching values or a verification label cannot establish
provenance. No coverage reduction or framework/database replacement is approved.
Accessibility work remains on hold; release evidence remains open.

The published general terms, service-specific caching rules, and Places
policies were rechecked on 2026-10-02:
[general terms](https://cloud.google.com/maps-platform/terms),
[service-specific terms](https://cloud.google.com/maps-platform/terms/maps-service-terms),
[Places policies](https://developers.google.com/maps/documentation/places/web-service/policies).
Account-specific permissions remain unverified.

## Open checks and alternative sources

Recorded at the Product Owner's request on 2026-10-02:

- [ ] Check whether the actual Google agreement permits a one-time internal
  spreadsheet export of existing Google-derived records for remediation/review.
  Distinguish this from continued directory operation and durable storage.
  Published general restrictions alone do not establish a specific cleanup
  exception or prove that separate new permission is always necessary. Obtain
  the applicable agreement/account basis before claiming this export is cleared;
  no provider contact or agreement acceptance is authorized here.
- [x] Evaluate Overture Places before assuming every existing
  fact must be manually collected. Compare Lenexa, Overland Park, and Olathe
  coverage, six-category fit, addresses/municipality precision, duplicates,
  freshness, weekly hours, notices/licenses, and ongoing access/cost. No
  replacement import has been performed. Overture sample evaluation is complete
  in [`KC3_37_SOURCE_EVALUATION.md`](KC3_37_SOURCE_EVALUATION.md): 462 raw
  category candidates, 289 in an operating/confidence probe, quality issues and
  missing weekly hours documented. Direct Foursquare coverage remains unmeasured;
  its portal requires an account, and the Product Owner chose to continue with
  Overture for now. Overture was subsequently selected as the starting source;
  no automated publication rules were approved.
- [ ] Direct Foursquare comparison is deferred pending portal access and a
  request to resume it. Overture's Foursquare subset is not full-dataset evidence.

These are data-use/license questions; privacy disclosures remain a separate
release concern. Primary-source research on 2026-10-02 identifies:

| Candidate | Published reuse basis | KC3 evaluation limits |
| --- | --- | --- |
| Overture Places | Downloadable place data; source-specific CDLA Permissive 2.0, Apache 2.0, and CC0 entries on its licensing page | Leading candidate for durable identity data after sampling. Preserve source/license/NOTICE requirements. Current Places schema has names, addresses, coordinates, categories, and operating status, but no weekly-hours field; operating status is not current open/closed state. Coverage sample measured; complete eligible inventory remains unverified. |
| Foursquare OS Places | Open dataset under Apache 2.0 with license/NOTICE requirements; free access via registered portal/catalog and other supported channels | Evaluate the open dataset separately from commercial APIs/enrichment; do not transfer its license to paid or additional data. Account access and local coverage unverified. |
| OpenStreetMap | Copying/adaptation permitted under ODbL with attribution and applicable database share-alike obligations | Evaluate database-combination/distribution implications for KC3-owned data; no assumption that separate tables alone avoid obligations. Local fields/freshness unmeasured. |
| Mapbox Search Box | API results documented for temporary use; storage requires discussion with sales | Not an automatic durable-directory substitute. Permanent geocoding is a separate product and does not include POI search. |

Sources:
[Overture Places guide](https://docs.overturemaps.org/guides/places/),
[Overture licensing](https://docs.overturemaps.org/attribution/),
[Overture Place schema](https://docs.overturemaps.org/schema/reference/places/place/),
[CDLA Permissive 2.0](https://cdla.dev/permissive-2-0/),
[Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0),
[Foursquare access/license](https://docs.foursquare.com/data-products/docs/access-fsq-os-places),
[Foursquare distribution/NOTICE guidance](https://foursquare.com/resources/blog/data/evolving-fsq-open-source-places/),
[OpenStreetMap license](https://www.openstreetmap.org/copyright/en),
[Mapbox Search Box restrictions](https://docs.mapbox.com/api/search/search-box/),
[Mapbox product distinction](https://docs.mapbox.com/help/getting-started/search/).

Accepted direction after sampling: use Overture Places as the starting source for
an importable licensed baseline plus KC3 curation; prepare reviewed identities
and independently maintained hours rather than assuming a fully manual launch
inventory. The [source evaluation](KC3_37_SOURCE_EVALUATION.md) records counts,
quality limits, licenses, and reproducible queries. Research is not production
clearance. A replacement license does not retroactively clear existing Google
copies. A 462-row review workbook and private reviewed-batch staging boundary
are now prepared; no staging batch has been imported or directory data replaced.

## Read-only local baseline

Executed `supabase/audits/kc3_37_content_inventory.sql` against
`supabase_db_KC3` on 2026-10-02 in a repeatable-read, read-only transaction ending
in rollback. Aggregate counts only; no provider contents or credentials exported.

| Surface | Observed count |
| --- | --- |
| Canonical places / active places | 88 / 88 |
| Google-linked places / provider rows | 73 / 73 |
| Canonical coordinate pairs / timezones | 73 / 73 |
| Canonical names / addresses matching current Google values | 72 / 70 |
| Canonical coordinates / timezones matching current Google values | 73 / 73 |
| Google hours rows / places with Google hours | 399 / 57 |
| KC3 hours / overrides / move relationships | 0 / 0 / 0 |
| Detail shells / populated detail rows / dated verification rows | 15 / 0 / 0 |
| Correction evidence rows / corrected places | 3 / 3 |
| Correction rows with name / address matching current Google context | 3 / 3 |

This target differs from historical 160/164-place runs. Do not reset it or assume
historical counts describe another target. Equality counts identify review
candidates only. All three correction rows retain matching Google context in
at least one snapshot; they still need per-field historical-source review.
The inventory also reports non-null counts for every `google_*` column.

No full inventory of hosted targets, ignored artifacts, local temporary files,
Docker logs/volumes, recordings, dumps, or backups is complete. A tracked-file
name search found no tracked dump/backup/log artifacts; that is not proof that
secondary copies are absent. Seed source citations and correction URLs are
evidence inputs, not blanket reuse clearance. Row counts cannot prove data
preservation; later migration checks must compare exact protected values.

## Implementation sequence after the decision

Step 1's source choice is recorded. The completed review-preparation phase
provides the licensed workbook, original manifest, strict CSV compiler/preview,
private staging migration and tests. Ready rows require review/evidence; unknown
hours and lifecycle remain explicit. Existing dataset reconciliation, Google
history/secondary-copy retirement, publication provenance/attribution/navigation,
operator eligibility and final verification remain open. No acceptance criterion
is closed solely by producing the spreadsheet.

1. Record the selected strategy and allowed coverage/cost changes in product,
   architecture, and decision documents. Establish source permissions or the
   applicable Google agreement/account region and use authorization.
2. Complete the target and secondary-copy inventory. Classify every canonical
   field, provider column, schedule/override, and historical snapshot against the
   audit. Define protected IDs, details, genuine evidence, schedules, and hidden
   decisions; design a reviewed history-remediation policy.
3. Specify field-level provenance and publication eligibility with explicit
   unknown states. Review operator eligibility, currently tied to Google-backed
   identity. Preserve anonymous RPC-only access and existing discovery semantics
   unless a deliberate product change is approved.
4. Implement the chosen ingestion/curation or live lookup boundary, allowed
   retention and attribution, effective source transport, navigation and fallback
   behavior. Prepare remediation against a disposable fixture before touching
   curated target data. Prove repeatability and prevent old ingestion/restore
   paths from resurrecting unsupported copies.
5. Run ownership, provenance, retention, history, rollback/concurrency, public
   boundary, application, database, and integration checks; verify exact protected
   values before/after. Check Web/native attribution/navigation and pinned-runtime
   CI. Keep deferred attended accessibility evidence open for release.
6. Reconcile the final build and dataset with rights/privacy evidence and
   secondary-copy disposition. Only close KC3-37 and unblock KC3-39 when every
   acceptance criterion has evidence.

Initial inventory changed no application behavior, schema, stored records, or
provider requests. Subsequent Overture preparation added trusted operator code,
a migration definition, tests, documentation, and a licensed workbook. The new
schema and fixture writes were tested in a transaction ending in rollback.
No migration was applied to the curated dataset, staging import performed,
database reset/purge, or deployment executed. Workbook verification, application
tests, typecheck/lint, database contract tests, and Expo exports are documented in
[Overture Review](OVERTURE_REVIEW.md). Production rights clearance is not claimed.
