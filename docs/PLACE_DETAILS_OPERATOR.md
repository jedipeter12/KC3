# KC3 Place-Details Operator CLI

## Purpose and boundary

`npm run edit:place-details` is an attended, internal workflow for finding an
existing active, Google-backed KC3 place and creating or updating its KC3-owned
`place_details` row. It is not a public or authenticated admin feature.

The supported path can write only seating, outlets, Wi-Fi, work suitability,
food/drinks, phone-call suitability, bathroom availability, drive-thru
availability, drive-thru-only status, and KC3 verification metadata. It cannot
write canonical identity, city, address, category, Google Place ID, lifecycle
status, provider metadata/freshness, hours, or overrides. The database function
owner has no mutation privilege on those protected tables or columns, and its
payload rejects unrecognized fields.

## Prerequisites

1. Use Node.js and npm versions from the repository pins and install dependencies.
2. Apply all Supabase migrations to the intended target.
3. Set `KC3_SUPABASE_URL` and `KC3_SUPABASE_SERVICE_ROLE_KEY` in the ignored
   `.env.local` file or operator environment. Never use `EXPO_PUBLIC_` names,
   print these values, or commit them.
4. Confirm the target before running. The command can change persisted data
   after its final confirmation; use a disposable local database for practice.

## Search and selection

Supply a nonempty name fragment and a city:

```sh
npm run edit:place-details -- --name "Black Dog" --city Lenexa
npm run edit:place-details -- --name "Library" --city "Overland Park"
npm run edit:place-details -- --name "Coffee" --city Olathe
```

Search is case-insensitive, matches the canonical name by substring, matches
the city exactly after trimming, and returns only active records with a Google
Place ID and provider row. Results are ordered by name, address, and KC3 ID.
Each option shows canonical name/address/type and bounded provider identity
context: Google name, address, Place ID, business status, and fetch time. Review
the full address and IDs before selecting when names are duplicated or nearby.
Enter the listed number to continue or `q` to stop without writing.

## Allowed values and unknown states

For every field, pressing Enter retains the current value.

| Field | Accepted input |
| --- | --- |
| Seating | Free text; `-` clears to unset |
| Outlets | `none`, `few`, `many`, `unknown` |
| Wi-Fi | `public`, `password_printed`, `password_on_request`, `none`, `unknown` |
| Work suitability | `good`, `okay`, `poor`, `unknown` |
| Food/drinks | `none`, `light`, `full`, `unknown` |
| Phone calls | `yes`, `no`, `unknown` |
| Bathroom | `yes`, `no`, `unknown` |
| Drive-thru available | `yes`, `no`, `unknown` |
| Drive-thru only | `yes`, `no`, `unknown`; `yes` requires drive-thru available `yes` |

`unknown` on an enum is the existing explicit unknown classification. `unknown`
on a nullable fact stores `null`: it makes neither a positive nor a negative
claim. Do not convert information you could not verify to `no`. Invalid input is
reported and prompted again before any write is attempted.

## Verification and confirmation

After the detail prompts, the command asks whether the operator actually
verified the KC3-owned information. Answering no preserves the prior
verification date and notes. Answering yes prompts for a real `YYYY-MM-DD` date,
defaulting to the operator machine's local date, and lets verification notes be
retained, replaced, or cleared. Unknown fields may remain unknown; the date
records the completed verification observation rather than inventing claims for
them.

The command then prints every changed KC3-owned value as a before/after list.
No database call is made when nothing changed. Otherwise, only the exact word
`yes` at the final prompt writes the complete validated detail snapshot. Any
other response cancels without a write.

## Failures and recovery

- Input validation stays in the prompt; correct the value and continue.
- A database rejection or connection failure produces a sanitized error and no
  partial write. Correct the configuration or data, then rerun the command.
- If another operator changed the detail row after selection, the write is
  rejected instead of overwriting newer data. Rerun the search, review the new
  current values, and apply the intended edit again.
- A canceled command can simply be rerun. There is no draft or partial state to
  recover.

For local testing, include missing rows, partial rows, already-verified rows,
duplicate-looking results, cancellation, invalid values, and each of Lenexa,
Overland Park, and Olathe. Database regression coverage also snapshots protected
identity, provider, and hours rows around supported updates.
