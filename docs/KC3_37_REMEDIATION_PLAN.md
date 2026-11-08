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
A [synthetic pipeline rehearsal](KC3_37_SYNTHETIC_REHEARSAL.md) on 2026-10-29
verified the implemented private staging and offline planning path in a
disposable Supabase project. It did not establish publication eligibility or
change the curated directory.
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

## 2026-11-01 implementation and disposition checkpoint

The reviewed publication migration and CLI are prepared on the current branch.
Disposable fixture transactions prove the reviewed source ledger and public
source gate; a matched legacy row keeps its exact KC3 UUID, details, and KC3 hours
while its Google ID, provider row, and Google hours are removed. Old Google RPC
execute grants and new Google-content writes are blocked; the historical CLI
fails before requesting Google. Existing unreviewed rows remain private behind
the public RLS gate. MVP visibility also requires independent eligibility
publication and no pending hours review. Client list/detail reads require a
migration-ready RPC and fail closed on a pre-gate database. No reviewed production
row, curated local row, or hosted
target was published or modified. The source ledger and client attribution path
are implemented, but actual release clearance remains open.

The clean disposable schema, bootstrap seed, active database tests `001`-`005`
and `014`-`016`, 118 Jest tests, TypeScript, ESLint, formatting, and Expo
Web/iOS/Android export were exercised on this branch. Historical Google-backed
database tests are retained under `supabase/legacy_tests/` and excluded from the
current gate. Synthetic operator replacement suite `019` now covers post-cutover
eligibility, protected writes, and correction evidence; expanded public and
effective-hours scenarios still require replacement tests before release.

### Post-cutover operator regression coverage (2026-11-08)

`supabase/tests/019_post_cutover_operators.test.sql` uses only synthetic
reviewed publications and an unpublished legacy row inside a transaction that
rolls back. It verifies both operator searches select active reviewed identities,
including duplicate-looking results, while excluding unpublished and hidden
places. It exercises detail creation and update, explicit unknown and
verification values, stale versions, malformed payloads, and preservation of
third-space classifications, identity, publication evidence, and hours. It also
checks canonical correction eligibility, stale versions, HTTPS and nonblank
evidence, exact before/after history, field provenance, and the narrow database
privileges of each operator. Injected audit-insert and provenance-update
failures prove canonical facts, provenance, and evidence roll back together.
The existing runner tests, expanded with reviewed Overture selection cases,
cover the final confirmation and cancellation prompts without a write.

Remaining attended scenarios include a real reviewed-row selection in each
city, duplicate identity review against the eventual curated dataset, live
service-role API execution after deployment, and final Web/native verification.
The historical Google-backed operator tests remain under `supabase/legacy_tests/`
for audit; they are not publication-eligible fixtures. This coverage does not
publish any actual workbook row or clear the outstanding KC3-37 release gates.

### Local and historical copy inventory

The 2026-11-01 read-only local audit still reports 88 places (73 Google-linked),
73 provider rows, 399 Google hours rows on 57 places, 15 detail shells, and 3
canonical-correction rows. The last three retain provider-context snapshots and
must be reviewed before their place can be matched. The source table, canonical
facts, hours, correction history, operator read models, seed, and any stored
override payload are the database surfaces. The current `place_overrides` count
is zero. Tracked source has no dump, backup, or CSV export. The old importer
code remains for historical tests but its entry point and database rights are
retired. The bootstrap seed contains 15 stable factual rows and detail shells;
the publication gate keeps any restored seed row private until independently
reviewed.

Local secondary surfaces found by filename inventory: the `supabase_db_KC3`
Docker volume; `supabase_db_KC3ThirdSpaceValidation` and
`supabase_db_KC3_37_Synthetic_Rehearsal` volumes; databases named `postgres`
and `kc3_third_space_operator_test` in the running KC3 cluster, plus a temporary
`kc3_37_fixture` used for this work. Aggregate-only inspection of
`kc3_third_space_operator_test` found zero places, provider rows, and Google
hours. The fixture held only synthetic/seed test rows and was dropped after
verification. Other volumes were
identified by name but not opened.
Ignored `.expo/dev/logs/export.log` files in the current and
three NOTES worktrees; synthetic rehearsal SQL/snapshot files in NOTES and
`/private/tmp/kc3-37-synthetic-input/snapshot.json`. Names alone do not prove
contents or deletion status. The workbook/manifest are licensed Overture
artifacts, not a Google export; the ignored `outputs/01a0ff66-…/` package also
contains Places/Hours CSVs, workbook data, inspection output, license text, and
NOTICE material. `outputs/background-readiness/` contains a historical code
patch that mentions Google schema names; it has not been classified as a
provider-content export. A name-only all-history Git search found a synthetic
rehearsal snapshot SQL file and no tracked dump/backup/CSV/XLSX history path.
Hosted databases, logs, object storage, backups,
recordings, user device caches, and provider/account retention settings remain
uninspected; no hosted inventory or purge is claimed.

### Reviewable migration and rollback order

1. Inventory each actual target and secondary copy read-only, with access-owner
   evidence and retention policy. Obtain the applicable agreement for any
   Google-derived internal export or deletion action. Review the 3 historical
   correction rows field by field; preserve genuinely independent evidence,
   redact unsupported snapshots only under an approved disposition. Do not
   silently delete KC3-owned corrections.
2. Review workbook rows and KC3 matches. Record exact before snapshots of IDs,
   details, KC3 hours, overrides, hidden/move decisions, and correction evidence
   in a secured, approved location. Compare normalized field values and source
   rights, not mere equality with Google. Explicitly decide what to do with
   unmatched legacy places; the publication gate hides them by default.
3. Apply staging and publication migrations together with the compatible
   client/operator build in a disposable target first. Use `approvals.json` and
   the dry run, then publish only reviewed rows. Re-run exact protected-value
   comparisons and `supabase/audits/kc3_37_publication_gate.sql`. The three
   published-Google counts and all old-RPC execute flags must be zero/false.
   Verify web/native attribution, external Maps labels, and anonymous RPCs.
4. For rollout, freeze old import/restore jobs, back up only under an approved
   storage/retention basis, deploy the gate before exposing clients, and repeat
   the post-restore audit on every target. A full pre-gate database restore can
   remove policies and triggers, so do not reconnect clients until migrations
   and audit are reapplied. Do not roll back to the Google-backed public RPCs.
   If a publication is wrong, stop new publication, hide the affected place
   through an audited correction/migration while preserving KC3 details, then
   republish a reviewed fix. Per-place transactions are atomic; a multi-row CLI
   run can stop after earlier commits, which the ledger makes reviewable.
5. Retire remaining private Google rows/hours, unsupported canonical facts and
   correction snapshots, then separately dispose of confirmed secondary copies
   under the approved retention plan. Recheck counts and permissions before
   KC3-37 or KC3-39 closure. Production deployment and deletion are not part of
   this branch work.
