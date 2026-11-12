# KC3-37 canonical-correction history review

**Review date:** 2026-11-10 (America/Chicago). **Status:** proposed disposition,
not authorization to edit or publish data.

## Scope and evidence limits

The 2026-10-02 and 2026-11-01 read-only inventories reported three correction
rows on three places. The correction run record identifies Kickapoo Park,
Heritage Forest Park, and Raven Ridge Park as the three local corrections. Its
recorded sources are the respective City of Lenexa or City of Olathe pages. The
inventories say every correction row has a name and an address matching current
Google context in at least one snapshot. Equality is a review signal, not proof
of origin or permission. The inventory does not identify which snapshot matched.

On 2026-11-10, a repeatable-read, read-only query of the running
`supabase_db_KC3` `postgres` database found **15 places and zero correction
rows**. That database is no longer the previously inventoried 88-place target.
The original row IDs, exact JSON snapshots, `source_observed_on`, and
`correction_notes` could therefore not be inspected. The run record gives a
2026-10-01 run date, which must not be substituted for the stored observation
date. This review uses only the documented changes and municipal pages; all
row-specific dispositions require verification against the original target or
an authorized, read-only copy. No history, place, or provider data was changed.

The recorded URLs currently show the following facts: [Lenexa's Kickapoo
page](https://www.lenexa.com/Parks-Places/Parks-Outdoors/Parks/Kickapoo-Park)
names the park and gives `14534 W. 93rd St., Lenexa, KS 66215`;
[Lenexa's Heritage Forest page](https://www.lenexa.com/Parks-Places/Parks-Outdoors/Parks/Heritage-Forest-Park)
names the park and locates it on W. 83rd Street west of Pflumm Road;
[Olathe's Raven Ridge page](https://www.olatheks.gov/government/parks-recreation/parks-trails-bike-lanes/raven-ridge-park)
names the park and gives `675 W. Harold St., Olathe, KS 66061` (also listed in
the [city parks directory](https://www.olatheks.gov/government/parks-recreation/parks-trails-bike-lanes)).
These are independent *factual sources*. The correction row has one URL and
notes for a whole edit, not field-level provenance. Current page content does
not prove what appeared there on the stored observation date, that the operator
used it for every unchanged field, or that its reuse terms have been cleared.

## Proposed field-level disposition

`Preserve` means retain the historical value with an explicit evidence and
origin annotation. `Redact` means remove the value from the snapshot through a
reviewed, traceable exception to normal immutability, while retaining the audit
row and a field-level redaction marker. `Replace` means re-source a *current
canonical fact* through the reviewed publication workflow; it does **not** mean
rewriting an old snapshot to pretend the new source was the old one. Every
proposal below is conditional on checking the actual row and the owner's
source-use decision.

| Place / field | Before snapshot: recorded evidence, provenance, proposal | After snapshot: recorded evidence, provenance, proposal |
| --- | --- | --- |
| Kickapoo / `name` | The prior canonical name with a provider suffix is recorded in the historical correction run; the KC3-33 audit flagged that suffix. No independent source supports it. **Redact** the old text, retaining the fact and field path of a name correction. | `Kickapoo Park` is on the cited city page. Independent factual support exists; the row's field-specific sourcing and use basis remain unverified. **Preserve** with the cited source after review; **replace** the current canonical fact from reviewed Overture/municipal evidence at publication. |
| Kickapoo / `address` | The documented intersection-style prior address has no recorded independent source and is a Google-context candidate. **Redact** its text; retain that the address changed. | The documented numbered address matches the city's location text. Independent factual support exists, subject to source-use and row checks. **Preserve** the historical corrected value; **replace** current canonical address only through reviewed publication. |
| Kickapoo / `addressPrecision` | `approximate` records KC3's prior classification, plausibly tied to the old intersection address; its geographic basis is unproven. **Preserve** only as a historical classification, explicitly not independent location evidence. | `street_address` follows the city-listed numbered address. **Preserve** as a supported KC3 classification, subject to row review; re-evaluate current precision in publication. |
| Kickapoo / `placeType` | `park` is the unchanged KC3 category; the municipal park page independently supports the classification, but does not prove historical input origin. **Preserve** with that qualification. | Same value and support. **Preserve**; review current classification at publication. |
| Heritage Forest / `name` | Unchanged `Heritage Forest Park` is on the cited city page. The fact has independent support, but the prior snapshot's origin is not established. **Preserve** only with an explicit source/origin distinction; redact if the approved use basis does not cover retention. | Same value and limitation. **Preserve** conditionally; source current canonical name in reviewed publication. |
| Heritage Forest / `address` | The documented malformed prior address has no independent evidence; the KC3-33 audit flagged it. **Redact** its text and retain the change marker. | The city describes W. 83rd Street west of Pflumm Road, without a street number. Independent factual support exists for the documented corrected location. **Preserve** conditionally; independently source the current address at publication. |
| Heritage Forest / `addressPrecision` | Unchanged `approximate` is KC3 historical classification; independent origin of the old address is unproven. **Preserve** only as prior classification. | The city gives an area/street description without a numbered site address, supporting `approximate`. **Preserve** conditionally; review current precision at publication. |
| Heritage Forest / `placeType` | Unchanged `park` is KC3 classification and supported by the city park page; original input origin is unproven. **Preserve** with qualification. | Same. **Preserve**; review current classification at publication. |
| Raven Ridge / `name` | Unchanged `Raven Ridge Park` is on the cited Olathe page. The KC3-33 audit separately reported punctuation in provider context; the correction record says the canonical name was retained. Independent factual support does not establish the prior snapshot's origin. **Preserve** conditionally with that distinction. | Same value and limitation. **Preserve** conditionally; source current canonical name in reviewed publication. |
| Raven Ridge / `address` | The documented punctuation-prefixed intersection address has no recorded independent support. **Redact** its text and retain the change marker. | The city's park page and directory give the numbered Harold Street location. Independent factual support exists for the corrected address. **Preserve** conditionally; source current address at publication. |
| Raven Ridge / `addressPrecision` | `approximate` is a prior KC3 classification tied to an unverified intersection location. **Preserve** only as historical classification, not location evidence. | `street_address` follows the city-listed numbered address. **Preserve** conditionally; review current precision at publication. |
| Raven Ridge / `placeType` | Unchanged `park` is KC3 classification and supported by the city park page; original input origin is unproven. **Preserve** with qualification. | Same. **Preserve**; review current classification at publication. |

For all three rows, **preserve** the row ID, place ID, creation timestamp,
source URL, source observation date, and notes only after inspecting the actual
values for embedded provider text. Redact provider text within notes if found;
do not fabricate a new observation date or note. The source URL proves that a
URL was recorded, not what it contained at the time or which snapshot fields it
supported. No corrected fact should be promoted to a published place merely
because it matches Google or because the audit row cites a city page.

## Audit and KC3-owned data protection

The existing decision requires immutable exact before/after evidence. Any
historical redaction would be a deliberate exception and needs a new decision
entry, reviewed migration, and a restricted, append-only redaction ledger with
row ID, JSON path, reason, evidence reference, reviewer, approval, and timestamp.
Do not delete or replace a correction row, rewrite `source_observed_on`, or
substitute a new value for what the operator saw. A marker must say the old value
was redacted, not `unknown` as though it had originally been unknown. Check the
`before_values <> after_values` constraint and consumer assumptions on a
disposable copy before choosing the marker representation. Hashes or backups of
removed text also need an approved retention basis; a digest is not proof of
independent provenance.

Before and after any approved migration, compare exact protected values for
stable KC3 place UUIDs, `place_details`, KC3 hours, overrides, hidden/move
decisions, and retained correction metadata. Restrict the original history to
the authorized review path; the existing publication function blocks a place
with any correction history from matched publication. Keep that block until
each row is reviewed and an explicit migration/reconciliation design is tested.
Recheck private tables, restores, dumps, logs, and other secondary copies under
the separate retention plan; redacting the live table alone does not retire
them. The earlier `KC3_36_CORRECTIONS.md` run record also contains the prior
provider-suffix text and belongs in that copy inventory. Do not use a full
pre-gate restore to re-expose the old directory.

## Exact owner decisions needed before implementation

1. Confirm the actual target or authorized read-only historical copy and review
   the three complete rows: IDs, both four-field snapshots, URLs, observation
   dates, notes, and any embedded provider text. Decide whether the documented
   parks are indeed those rows. If unavailable, keep their publication blocked.
2. Approve or reject use of the municipal page facts for durable KC3 identity
   and historical evidence, including the applicable use basis and any required
   attribution. Decide whether unchanged names may be retained with later
   independent corroboration while their original provenance remains unknown;
   otherwise redact those snapshot occurrences too.
3. Approve the specific history exception: redact the three documented prior
   address strings and Kickapoo's prior name, retain the row and change markers,
   decide the marker/ledger format and restricted access, and decide any further
   redactions found in exact notes or snapshots. Do not call a redacted snapshot
   an exact original snapshot.
4. Decide, for each park, whether a reviewed Overture row will match its stable
   KC3 UUID and which independently evidenced name, address, precision, type,
   municipality, coordinates, timezone, lifecycle, and hours are publishable.
   This history review alone authorizes none of those fields for publication.
5. Approve the target-specific backup, log, restore, and secondary-copy
   retention/disposal plan and the exact protected-value comparison before any
   migration. Keep the KC3-37/KC3-39 release gates open until the full audit is
   complete.
