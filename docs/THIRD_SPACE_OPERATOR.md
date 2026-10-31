# Attended third-space review

Use `npm run review:third-space` from a trusted operator terminal with the server-only `KC3_SUPABASE_URL` and `KC3_SUPABASE_SERVICE_ROLE_KEY` environment variables. The Expo client receives neither this command nor its credential. The workflow never calls a provider.

## Review an existing discovery

```sh
npm run review:third-space -- --name "Board Game" --city Lenexa
npm run review:third-space -- --source reddit
```

At least one of `--name`, `--city`, or `--source` is required. Search returns at most 50 private discovery rows. It includes unlinked leads and canonical-linked discoveries from any listed source. Select the numbered row after checking its discovery ID, source, discovery date, and canonical identity. The command then displays the complete current review, KC3 classification, weekly hours with source/observation, publication state, and hours-review revision before prompting. Blank keeps the current value. `unknown` clears a nullable fact; `no` stores verified false. For activity lists, `-` means unknown and `none` means confirmed empty. Changing the verification date or verified review requires an explicit answer that the operator actually checked the facts. A state change does not infer a date.

The command shows each before/after change and requires exact `yes` to save. Database persistence is atomic and rejects changed discovery, canonical place, detail, or hours versions. On stale or failed writes, search again and inspect the newest values. A lead without a canonical place can have its private review edited, but cannot receive canonical classification or publication values.

## Start a review for an existing canonical place

Some older canonical places have no discovery row. Use their known KC3 UUID:

```sh
npm run review:third-space -- --place-id <canonical-uuid>
```

The operator sees canonical identity, current KC3 classification, and hours before entering the **actual** discovery source and date. No source is inferred. Exact `yes` creates a private `discovered` review with all checklist values unknown. That creation is a separate confirmed write: if later editing is cancelled, the private review remains available through normal discovery search. An existing discovery or stale canonical version blocks duplicate creation.

## Eligibility after hours change

An insert, edit, or removal of an hours row or regular-hours override increments a separate eligibility-review revision. A future-dated override also reopens review when it becomes active or expires. The public RPCs hide a published place while its hours revision or effective override is pending review; provider refresh never changes `mvp_published`, `mvp_eligible`, or KC3 classification fields. The operator sees the raw rows with provenance, the effective regular schedule, active override ID, and pending revision. Completing the hours review with publication retained requires a verified discovery checklist, positive third-space and MVP eligibility, reviewed hours, target-city active place, and a current interval covering 8 p.m. The 8 p.m. check uses the effective schedule when one resolves, including an active override; it falls back to a known raw interval for partial schedules. If the place no longer qualifies, set MVP eligibility and publication to `no` and confirm the hours review. A later hours change creates a new pending revision. Existing published records are grandfathered only until their hours next change; reviewing one then requires the full checklist to keep it public.

The database owner for these server-only RPCs can read private review context and update only the named discovery review, new KC3 classification, and publication columns. It cannot edit canonical identity, provider metadata, or hours. The Google importer has no insert/update privilege on the publication column. This workflow does not resolve Overture rights, reconcile source cutover, or publish staged Overture rows.

## Local verification

On 2026-10-30, the full migration set and seed applied to a disposable database
inside the local Supabase PostgreSQL container. After rebasing on the KC3-37
rehearsal merge, all 373 pgTAP assertions passed,
including source-agnostic review creation, unknown/false and empty/unknown
classification, stale edits, changed-hours visibility, provider preservation,
grandfathered publication, and effective override changes. Supabase database
lint reported no schema errors before the rebase.
All 135 application tests, TypeScript, ESLint, Prettier, and Web/iOS/Android Expo
exports passed. The active KC3 database was not reset or modified. No live
provider request, hosted migration, or release cutover was performed.
