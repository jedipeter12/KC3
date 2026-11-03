# Overture Spreadsheet Review and Staging

KC3-37, 2026-10-02. The Product Owner selected Overture as the starting source
and requested separate verification and missing-value flags. This phase delivers
the review workbook and the private import lane. Canonical publication and
Google-data retirement follow reviewed content and reconciliation; the ticket
is still In progress. Accessibility remains on hold.

## Workbook

Generated artifact: `outputs/01a0ff66-ebbb-72c2-a2ee-8b8750222b9f/KC3_Overture_Review.xlsx`.
Generated artifacts are ignored by Git. Keep the original `manifest.json`
beside the workbook; it is the licensed source snapshot used by import
validation, not a Google export. The user only needs to edit and return the
workbook; the agent/operator can extract the two review tables to CSV.

- Start here: instructions, live Pending/Ready counts, and color/text legend.
- Places: 462 candidates across the six provisional category mappings and three
  postal localities. No confidence/lifecycle threshold silently drops candidates.
  Filter/sort complete table rows, keeping Overture IDs attached.
- Hours: one separately keyed row per candidate, all schedules initially blank.
- Sources: original selected facts, taxonomy, lifecycle, confidence, contributor
  licenses and field/source metadata. Treat this and Overture IDs as reference.
- Licenses: complete CDLA/Apache text, Foursquare NOTICE, source attribution,
  CC0 link, and a prominent account of KC3's subset/mapping/format changes.

Amber marks Pending review, initial verification flags, unknown address
precision, non-open lifecycle, and low existence confidence. Blue marks empty
address/postcode/website/review-date/lifecycle and empty hours/evidence fields.
The editable Place status follows known provider lifecycle; it stays blank when
the provider lifecycle is unknown. A changed or newly established status needs
independent evidence, and unknown status cannot become a Ready active place.
Missing-value text updates with edits. Table banding is neutral so it does not
look like a missing-data flag. Do not infer a field has been verified from a
neutral fill. Missing optional website/postcode and unknown hours do not prevent
an otherwise complete identity from being reviewed. Initial flags remain
reference context after a row is marked Ready; they are not silently erased.

## Review rules

Leave unfinished rows Pending; mark unsuitable candidates Exclude. Ready means
the reviewer has checked identity, city boundary, category/access, lifecycle,
duplicates, and relevant flags. Required identity inputs are name, approved city
and type/status, nonempty address, valid coordinates and timezone, address precision,
source URL, reviewed date, and reuse basis. Address precision may stay unknown.
America/Chicago is derived from the three target Kansas cities, not provider
hours. The publication step must independently reconcile municipal eligibility
and stable KC3 IDs; no full-coverage guarantee is made by postal locality.

For unchanged selected Overture facts, retain `Overture license` and the supplied
source URL; the manifest carries contributor permissions/provenance. Edited
facts need independent source evidence, `Business supplied` or `Permitted source`,
and explanatory source/permission notes. Public readability alone is not a reuse
grant. The source snapshot is retained separately from edits. Dates use
YYYY-MM-DD and cannot be future/invalid. Identity review is never translated
into KC3 suitability verification. Website/postcode are optional; absence stays
null, not an invented value.

Hours Ready requires a Ready place in the same batch, independent HTTPS source,
observed date, reuse basis, and notes. The `Hours rule` column is either
`weekly` (all seven explicit days required) or `dawn_to_dusk` (parks only; leave
the weekday cells blank). Enter `Closed`, `24h`, `09:00-17:00`, semicolon-separated
split periods, or `22:00-02:00+1` for an overnight close. Blank means unknown, not
closed. Overlapping and ambiguous intervals fail, including across
Saturday/Sunday. Pending/Exclude schedules are skipped and do not clear existing
hours. A dawn-to-dusk rule is evaluated from the published place coordinates at
the current local sunrise and sunset, so its seasonal clock times are calculated
by KC3 rather than copied into the workbook. The 14-day freshness rule still
applies to fixed weekly schedules; a validated dawn-to-dusk policy is not made
unknown merely because the sun's clock times change. Private JSON staging also
rejects unsupported rule names and dawn-to-dusk rules on non-parks or with
fabricated clock rows.

Leave KC3 place ID empty unless a reviewed match is supplied. IDs are never
automatically assigned by fuzzy matching or copied from Google contents into
the workbook. Existing seed matches from the evaluation are suggestions, not
approved mappings. Multiple Ready candidates cannot target one KC3 ID. Names
shared by genuinely different locations must not be collapsed.

## Operator workflow

No Overture account or API key is needed. Use the pinned project runtime for
the TypeScript CLIs. No new project dependencies were added. The standalone
artifact authoring runtime is only used by the agent to create/read XLSX.

Prepare a fresh review package from the licensed regional JSON extracted by the
research query (preserve required license/NOTICE material with any distribution):

```sh
npm run prepare:overture-review -- regional.json output-directory
```

This writes a source manifest, workbook input data, and Places/Hours CSV
templates; it never reads Supabase or changes records. It currently supports
Overture release 2026-09-23.1. A newer release requires an explicit schema/license
review and release-boundary update, not silent refresh over curated values.
Workbook layout/formula/validation rules are described above. Original source
license text and notices are versioned in `docs/licenses/overture/`.

After review, export Places and Hours as CSV with their headers preserved. Keep
the original manifest. An agent using the bundled XLSX reader must retain
identifiers as strings, convert typed dates to ISO dates, and preserve nulls and
numeric precision. Use displayed coordinate precision of 12 decimal places;
the compiler tolerates only submillimeter rounding differences (1e-9 degrees).

Preview the exact approved payload without credentials or database writes:

```sh
npm run import:overture-review -- manifest.json places.csv hours.csv preview.json
```

Exclusive creation prevents any existing workbook, manifest, CSV, or prior
preview from being overwritten. An identical existing preview can be reused for
the staging step; changed content requires a new preview filename.

The compiler rejects unknown/duplicate IDs, changed columns, malformed CSV,
unsupported cities/types/licenses, missing required Ready inputs, invalid
coordinates/timezones/dates/URLs, changed facts without independent evidence,
duplicate targets, incomplete schedules, and overlapping intervals. Blank and
zero remain distinct. Pending/Exclude rows are skipped and can contain unfinished
facts. An empty Ready set produces an empty preview and performs no staging.
Batch IDs derive from the release, manifest digest, and sorted approved content.

Apply `20261002000000_add_overture_review_staging.sql` through the normal migration
workflow to a reviewed target before staging. Server-only config uses
`KC3_SUPABASE_URL` and `KC3_SUPABASE_SERVICE_ROLE_KEY`, never Expo variables.
Use the same command plus `--stage`; the CLI saves the exact preview and requires
the literal `STAGE <batch-id>` confirmation before sending it. Database errors
are sanitized; credentials and raw server messages are never logged.

The RPC stages one entire batch atomically into `overture_review_batches`. Same
ID/same content repeats without another row; same ID/different content fails.
No anon/authenticated/direct service-role table grants exist. The dedicated
NOLOGIN owner cannot change canonical places, KC3 details, hours, overrides, or
correction evidence. Staging is append-only; publication, merging, hiding old
records, deleting Google copies, and history remediation are separate work.

## Validation and remaining work

Application tests cover readiness/evidence, unknown hours, full-week schedules,
day/week overlaps, malformed/multiline CSV, duplicate IDs, missing inputs,
timezone/date bounds, source-license checks, and repeatable batches. Database
tests cover the narrow permission boundary, malformed batches, idempotency,
conflicting content, atomic rejection, and absence of canonical publication.
The migration/tests were exercised in a transaction ending in rollback against
the current local schema. No reset, migration application, or staging import
was performed on the curated target. The all-Pending package previews zero Ready
records. Workbook live controls, formula errors, all five sheets' renderings,
and export/reopen identity preservation were checked.

Local validation passed: typecheck, lint, formatting, 102 application tests,
6 live Supabase integration checks, 18 new database assertions, and Expo
Web/iOS/Android export. Available Node 26 was used locally; the pinned Node
24.20.0 CI checks remain required before release. No native Excel session or
attended platform accessibility review is claimed.

Before KC3-37 closes, complete actual user review, exact protected-data
reconciliation, field-level publication provenance and eligibility, attribution
and navigation, adapted detail/correction operators, retirement of old Google
canonical/provider/hours/history and secondary copies, prevention of old
import/restore resurrection, and full application/database/integration/platform
verification. Keep the applicable Google agreement/internal-export check open;
do not use it as a prerequisite for this independent-source workbook.

## Dry-run reconciliation follow-up, 2026-10-03

The reviewed CSV compiler now also feeds an offline reconciliation planner.
It requires a complete permitted snapshot, reports explicit ID matches and
conflicts, and never publishes or retires data. See
[Overture Reconciliation](OVERTURE_RECONCILIATION.md). This does not complete
spreadsheet review or authorize a Google-content export.

## Reviewed publication path (implementation prepared 2026-11-01)

`20261101000000_reviewed_overture_publication.sql` adds a private source
publication ledger and a service-only, per-place transaction. Migration alone
publishes no row. Anonymous list/detail RPCs require a source publication row,
`mvp_published`, and no pending hours eligibility review.
The source publisher does not set MVP eligibility or clear a pending hours
review. New source-published places remain private until the attended
third-space operator completes that separate review.
The source ledger keeps the exact Overture source snapshot, identity evidence,
field-level source basis, hours evidence when supplied, batch ID, and stable KC3 ID.
The publication ledger also retains the operator's municipality/duplicate
review notes. Category mapping, address precision, and regional timezone are labeled as KC3
review/derivation rather than raw Overture facts. Anonymous attribution
returns the source, contributor license identifiers, review date, and license URL.
The list footer and detail page show Overture attribution and link to license
details; the detail action names the external Maps service. The
name/address query uses only the reviewed canonical identity after cutover. The
client checks `kc3_publication_gate_ready()` before list or detail reads; if it
runs against an older database or a full pre-gate restore, it shows an
unavailable state instead of labeling old content as Overture.

Prepare an `approvals.json` beside the exact `preview.json`:

```json
{
  "batchId": "reviewed-batch-uuid",
  "entries": [
    {
      "overtureId": "reviewed-overture-uuid",
      "targetPlaceId": null,
      "expectedUpdatedAt": null,
      "municipalEligibilityConfirmed": true,
      "duplicateReviewConfirmed": true,
      "reviewNotes": "What independent review established the boundary and identity"
    }
  ]
}
```

For a matched place, use the reviewed KC3 UUID and its current database
`updated_at` ISO timestamp. The target must equal the workbook's reviewed
mapping. Publication requires explicit municipality and duplicate confirmation;
it refuses stale targets, prior publication, hidden-state reversal, move links,
correction history, overrides, and a conflicting KC3 hours schedule. These
cases remain for separate attended review. The transaction preserves existing
KC3 detail rows and KC3 hours, updates the same KC3 UUID with reviewed facts,
clears its Google ID/provider row/Google hours, and inserts provenance. A new
identity receives a new UUID and no invented suitability or hours. The CLI
defaults to a read-only preview:

```sh
npm run publish:overture-review -- preview.json approvals.json
npm run publish:overture-review -- preview.json approvals.json --publish
```

The second command requires `PUBLISH <batch-id>` and confirms the exact staged
batch before per-place writes. A failure may leave earlier places published;
inspect the ledger and prepare a revised approval file for remaining rows. Do
not use this command against the curated target until actual rows, protected
values, history, and secondary-copy dispositions are reviewed. No current
workbook row has been approved for publication.
