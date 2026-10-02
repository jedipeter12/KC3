# KC3 Canonical Correction Operator

## Purpose and boundary

`npm run edit:place-canonical` is an attended, internal workflow for correcting
factual canonical values on an existing active, Google-backed KC3 place. It is
intended for reviewed cases such as a provider name suffix, a malformed address,
an address-precision correction, or an incorrect KC3 place classification.

The workflow can change only:

- canonical name;
- canonical address;
- address precision (`street_address`, `approximate`, or `unknown`); and
- KC3 place type (`coffee_shop`, `cafe`, `boba_tea`, `library`, `coworking`, or
  `park`).

It cannot change city, coordinates, timezone, Google Place ID, lifecycle or move
state, provider metadata, KC3 suitability details, hours, or overrides. It does
not create, merge, hide, or delete places and does not model relationships
between places. Those actions require separate reviewed workflows.

## Prerequisites

1. Use the repository-pinned Node.js and npm versions and install dependencies.
2. Apply all Supabase migrations to the intended target.
3. Set `KC3_SUPABASE_URL` and `KC3_SUPABASE_SERVICE_ROLE_KEY` in ignored local
   configuration or the operator environment. Never use `EXPO_PUBLIC_` names,
   print these values, or commit them.
4. Confirm that the proposed value is supported by an authoritative HTTPS source
   and that the selected record is the same physical place.
5. Confirm the target environment. Practice against a disposable local database.

## Search and selection

Supply a nonempty canonical-name fragment and an exact city:

```sh
npm run edit:place-canonical -- --name "Kickapoo" --city Lenexa
npm run edit:place-canonical -- --name "Raven" --city Olathe
```

Search is case-insensitive and returns only active records that have both a
Google Place ID and provider row. Results are ordered by canonical name, address,
and stable KC3 ID. Each option displays the canonical values plus bounded Google
name, address, primary/type list, Place ID, business status, and fetch time.
Review the complete identity context before entering a result number; enter `q`
to exit without writing.

## Correction and evidence

Press Enter at a canonical prompt to retain the current value. Required text
cannot be cleared, and classifications must use a listed value. If every value
is retained, the command exits before asking for evidence or writing anything.

Every actual correction requires:

- an authoritative `https://` source URL;
- the real date the source was observed, in `YYYY-MM-DD` format; and
- nonblank notes explaining what the source establishes.

Use the narrowest factual correction supported by the evidence. An area or
intersection description should normally remain `approximate`; do not invent a
street number merely to obtain `street_address`. Provider output alone can be
useful comparison context, but a correction should be based on the cited source.

The command prints the changed fields and evidence, then requires the exact word
`yes`. A successful transaction updates the four-field canonical snapshot and
adds one immutable `place_canonical_corrections` row containing the exact before
and after values plus evidence. The update and audit insert succeed or fail
together.

## Concurrency, import behavior, and recovery

The write includes the place `updated_at` value returned by search. If any other
workflow changes the place before confirmation, the correction is rejected
instead of overwriting newer data. Search again, review the current values, and
reapply the correction.

The existing importer keeps substantive canonical differences for operator
review; it does not overwrite an accepted correction merely because the next
provider response still contains the old provider value. Provider values remain
unchanged in `place_google_data`, preserving the comparison and source boundary.

A validation, authorization, connection, concurrency, or audit failure rolls
back the whole transaction and returns a sanitized CLI error. There is no draft
or partial correction to recover. Rerun after correcting the cause.

The service-role credential reaches only two approved RPCs for this workflow.
Their dedicated `NOLOGIN`, non-bypass-RLS owner has column-scoped update access
to the four canonical fields and insert-only access to the audit table. Client
roles have no execution or direct-table access.
