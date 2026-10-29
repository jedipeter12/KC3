# KC3-37 Synthetic Overture Pipeline Rehearsal

Run on 2026-10-28/29 in `codex/kc3-37-rehearsal`, based on `main` at
`d14702dda30e3bab24edf637b64febc968da75ce`. This is a disposable local
exercise, not an attended content review, publication decision, or cutover.
No curated KC3 database, Google-derived record, or production service was used.
The only database container addressed by the commands below is
`supabase_db_KC3_37_Synthetic_Rehearsal` on port `56322`; the curated local
`supabase_db_KC3` uses port `54322` and was never queried or mutated.

## Reproduce the inputs and scratch project

Run from the isolated worktree with project dependencies installed. The run used
Node 26.7.0 and npm 11.19.0, with a symlink to the existing checkout's
`node_modules`; the pinned Node 24.20.0 CI runtime was not available locally.
The fixture generator exclusively creates files, so use a fresh input directory.
All names, IDs, evidence, schedules, and protected values are synthetic.

```sh
node --import tsx scripts/research/kc3-37-synthetic-fixture.ts /private/tmp/kc3-37-synthetic-input
npm run import:overture-review -- /private/tmp/kc3-37-synthetic-input/manifest.json /private/tmp/kc3-37-synthetic-input/places.csv /private/tmp/kc3-37-synthetic-input/hours.csv /private/tmp/kc3-37-synthetic-input/preview.json
```

The `workbook-data.json` file holds the four Places and Hours table rows that
would be exported from a review workbook. The rejection-probe script compares
every table cell to the parsed CSVs, then exercises malformed CSV and review
cases. No native `.xlsx` creation, formulas, formatting, data validation, or
Excel export were implemented or exercised by this repository path.

For the database part, copy `supabase/` into a *new* disposable project
directory. Set its `project_id` to `KC3_37_Synthetic_Rehearsal`, change all
`5432x` ports to `5632x`, and set `[db.seed] enabled = false` before starting.
The scratch copy must contain this branch's fixed staging migration. Verify the
project ID and ports before running any reset or staging command. The run used:

```sh
mkdir -p /private/tmp/kc3-37-synthetic-supabase
cp -R supabase /private/tmp/kc3-37-synthetic-supabase/
perl -0pi -e 's/project_id = "KC3"/project_id = "KC3_37_Synthetic_Rehearsal"/; s/5432([0-9])/5632$1/g; s/(\[db\.seed\][\s\S]*?enabled = )true/${1}false/' /private/tmp/kc3-37-synthetic-supabase/supabase/config.toml
./node_modules/.bin/supabase start --workdir /private/tmp/kc3-37-synthetic-supabase --exclude realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor --yes
docker exec -i supabase_db_KC3_37_Synthetic_Rehearsal psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -f /dev/stdin < supabase/audits/kc3_37_synthetic_rehearsal_seed.sql
```

The seed inserts one existing synthetic KC3 place and one full row in each
protected section: detail, KC3 hours, override, and correction evidence. It
inserts no Google provider row. The rehearsal ran the staging migration from a
fresh scratch database; after finding the UUID defect below, only this scratch
project was reset and seeded again with the fixed migration.

## Commands and observed results

```sh
docker exec -i supabase_db_KC3_37_Synthetic_Rehearsal psql -X -A -t -U postgres -d postgres -v ON_ERROR_STOP=1 -f /dev/stdin < supabase/audits/kc3_37_synthetic_rehearsal_snapshot.sql > /private/tmp/kc3-37-synthetic-input/db-before.json
npm run plan:overture-reconciliation -- /private/tmp/kc3-37-synthetic-input/manifest.json /private/tmp/kc3-37-synthetic-input/places.csv /private/tmp/kc3-37-synthetic-input/hours.csv /private/tmp/kc3-37-synthetic-input/db-before.json /private/tmp/kc3-37-synthetic-input/db-report.json
node --import tsx scripts/research/kc3-37-stage-scratch.ts
node --import tsx scripts/research/kc3-37-stage-scratch.ts
docker exec -i supabase_db_KC3_37_Synthetic_Rehearsal psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -f /dev/stdin < supabase/audits/kc3_37_synthetic_rehearsal_checks.sql
docker exec -i supabase_db_KC3_37_Synthetic_Rehearsal psql -X -A -t -U postgres -d postgres -v ON_ERROR_STOP=1 -f /dev/stdin < supabase/audits/kc3_37_synthetic_rehearsal_snapshot.sql > /private/tmp/kc3-37-synthetic-input/db-after.json
node --import tsx scripts/research/kc3-37-rejection-probes.ts
docker exec -i supabase_db_KC3_37_Synthetic_Rehearsal psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -f /dev/stdin < supabase/tests/014_overture_review_staging.test.sql
```

The guarded staging helper obtains the local service key from this scratch
project's CLI status in memory, requires API port `56321`, and supplies the
literal `STAGE <batch-id>` confirmation to the normal import CLI. It never
prints or writes the key. Do not point it at another project.

| Check | Observed result |
| --- | --- |
| Workbook table data / CSV parity | Four synthetic rows in each table; every cell matched decoded CSV; two Ready, one Pending, one Exclude. |
| Preview | Two Ready identities and one independently evidenced Ready schedule; Pending/Exclude skipped. Matched identity had unknown reviewed hours (`hours: null`). |
| Private staging | First call: `staged` two records. Identical repeat: `unchanged`; one batch row remained. No canonical place was inserted or changed. |
| Offline planner | One `matched_candidate` with explicit KC3 ID and changed `name`; `preserve_existing_or_unknown` hours. One `new_candidate_requires_review` with reviewed hours. `publicationAllowed: false`; four unresolved gates. |
| Rejected CSV/review data | Changed header, unclosed quote, future review date, duplicate case-variant target UUID, and incomplete Ready hours all failed before creating previews. A changed batch could not overwrite an existing preview. |
| Conflict planning | Unknown explicit target, hidden-status change, city change, and proposed reviewed hours against existing KC3 hours were reported as blocked. |
| RPC rejection / rollback | Malformed second record rejected atomically; changed content under the same batch ID rejected; a valid probe staged inside a transaction disappeared after rollback. |
| Exact protected comparison | Database-generated before/after JSON snapshots each had one place and full protected rows. `verifyProtectedReconciliation` returned `[]`; changing a verified `false` to `true` in a copy returned that KC3 ID. |
| Authorization/DB contract | All 20 Overture pgTAP assertions passed inside a rollback transaction, including direct table/role denial and both UUID case-variant regressions. |

The exact comparison was run with:

```sh
node --import tsx -e 'const fs=require("node:fs"); const {parseReconciliationSnapshot,verifyProtectedReconciliation}=require("./src/ingestion/overtureReconciliation"); const before=parseReconciliationSnapshot(JSON.parse(fs.readFileSync("/private/tmp/kc3-37-synthetic-input/db-before.json","utf8"))); const after=parseReconciliationSnapshot(JSON.parse(fs.readFileSync("/private/tmp/kc3-37-synthetic-input/db-after.json","utf8"))); const changed=verifyProtectedReconciliation(before,after); const altered=structuredClone(after); altered.places[0].protected.details[0].bathroom_available=true; const detected=verifyProtectedReconciliation(before,altered); console.log({changedProtectedIds:changed,tamperedProtectedIds:detected}); if(changed.length!==0||detected.length!==1) process.exitCode=1;'
```

Static checks: `npm run typecheck`, `npm run lint`, and
`npm run format:check` passed. `npm run test:app` passed 17 suites and 129 tests.
Expo export passed for Web, iOS, and Android using example public Supabase
configuration. The local database assertions used the installed Supabase CLI
2.115.0. The rehearsal did not exercise a native Excel or mobile session.

## Defect found and fixed

Before the fix, the direct staging RPC accepted two distinct text spellings of
the same KC3 UUID as two targets; pgTAP reported failure on this probe. The
same issue applied to Overture UUIDs in the RPC, and the manifest compiler's
duplicate check was case-sensitive. UUID uniqueness now compares parsed UUIDs
in PostgreSQL and lowercased IDs in TypeScript. Focused tests cover both
boundaries. The fixed migration was applied only to the scratch project; no
curated database migration was run.

## Precise implementation boundary

The current path ends at **private append-only reviewed-batch staging plus an
offline, dry-run reconciliation report and a pure protected-value comparison**.
There is no implemented operation to apply the report, allocate KC3 IDs for new
places, decide municipal eligibility, publish canonical values or hours, clear
old Google data/history/secondary copies, change operator eligibility, or add
source-aware attribution/navigation. Snapshot completeness and source permission
remain operator responsibilities. Nothing here establishes publication rules or
completes KC3-37. The curated KC3 database and real Google-derived records were
left untouched; no cutover occurred.
The disposable project was stopped after verification with
`supabase stop --workdir /private/tmp/kc3-37-synthetic-supabase`; its local
backup remains in the scratch project for inspection or rerun.
