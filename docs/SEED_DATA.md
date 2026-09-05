# Seed Data

## Purpose

`supabase/seed.sql` supplies realistic local records for database and early client
development. Supabase runs it automatically after migrations during
`supabase db reset`.

The initial dataset contains 15 places: five each in Lenexa, Overland Park, and
Olathe. It represents coffee shops, libraries, and parks without attempting to
cover every approved place type.

## Safety and Ownership Rules

- The complete seed runs inside one transaction.
- Every seed place has a repository-owned stable UUID.
- Existing UUIDs and exact canonical matches win; the seed never updates them.
- KC3 detail rows are inserted only when absent, using the schema's explicit
  unknown and nullable-unverified defaults.
- A rerun never overwrites KC3-curated detail fields.
- The seed does not populate `place_google_data`, Google Place IDs, raw Google
  payloads, or Google-sourced hours.
- The seed does not populate weekly hours because schedules are volatile and the
  production provenance/refresh workflow is not approved.
- This local bootstrap is not a general deduplication system or a production
  administrative/import path.

## Initial Sources

Names and addresses were checked on 2026-09-05 against the location's own site or
the responsible local government's site:

### Lenexa

- [Lenexa City Center Library](https://www.jocolibrary.org/locations/lenexa/)
- [Black Dog Coffeehouse](https://bdcoffeehouse.com/contact)
- [Maps Coffee & Chocolate](https://mapscoffee.com/pages/contact-us)
- [Black Hoof Park](https://www.lenexa.com/Parks-Places/Parks-Outdoors/Parks/Black-Hoof-Park)
- [Sar-Ko-Par Trails Park](https://www.lenexa.com/Parks-Places/Parks-Outdoors/Parks/Sar-Ko-Par-Trails-Park)

### Overland Park

- [Johnson County Library locations](https://www.jocolibrary.org/locations) for
  Blue Valley, Central Resource, and Oak Park libraries
- [Homer's Coffee House](https://homerscoffeehouse.com/)
- [Pilgrim Coffee Company](https://pilgrimcoffeecompany.com/)

### Olathe

- [Olathe Public Library locations](https://www.olathelibrary.org/about-us/hours-locations)
  for the Downtown and Indian Creek libraries
- [Sweet Tee's Coffee Shop](https://www.sweetteescoffeeshop.com/)
- [Apogee Coffee & Draft](https://www.apogeekc.com/about)
- [Black Bob Park](https://www.olatheks.gov/government/parks-recreation/parks-trails-bike-lanes/black-bob-park)

## Maintenance

Treat canonical corrections as reviewed data changes. Update `supabase/seed.sql`,
the expected rows in `supabase/tests/005_seed_data.test.sql`, and the source list
above together. Verify both a clean reset and a second execution of the seed
against the same database before merging.
