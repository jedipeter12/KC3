begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(10);

-- A grandfathered MVP place can become public after both source publication
-- and a separate review of the new hours revision.
insert into public.places (id, name, city, address, place_type, mvp_published)
values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Dawn Park',
  'Lenexa', '3 Main St', 'park', true);
select updated_at::text as target_updated_at from public.places
where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' \gset

create function pg_temp.dawn_batch() returns jsonb language sql as $$
select '{
  "schemaVersion":1,"batchId":"dddddddd-dddd-dddd-dddd-dddddddddddd",
  "release":"2026-09-23.1","manifestSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "records":[{
    "overtureId":"dddddddd-dddd-dddd-dddd-dddddddddddd","targetPlaceId":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
    "identity":{"name":"Dawn Park","city":"Lenexa","address":"3 Main St","placeType":"park","status":"active","addressPrecision":"street_address","latitude":38.9,"longitude":-94.7,"timeZone":"America/Chicago","website":null,"postcode":null},
    "identityEvidence":{"sourceUrl":"https://docs.overturemaps.org/getting-data/duckdb/","observedOn":"2026-10-02","reuseBasis":"Overture license","notes":""},
    "source":{"id":"dddddddd-dddd-dddd-dddd-dddddddddddd","sources":[{"dataset":"meta","license":"CDLA-Permissive-2.0"}]},
    "hours":{"sourceUrl":"https://example.org/dawn-park-hours","observedOn":"2026-10-02","reuseBasis":"Permitted source","notes":"Municipal policy confirms dawn-to-dusk access.","ruleType":"dawn_to_dusk","periods":[{"dayOfWeek":0,"openTime":null,"closeTime":null,"isClosed":true,"closesNextDay":false},{"dayOfWeek":1,"openTime":null,"closeTime":null,"isClosed":true,"closesNextDay":false},{"dayOfWeek":2,"openTime":null,"closeTime":null,"isClosed":true,"closesNextDay":false},{"dayOfWeek":3,"openTime":null,"closeTime":null,"isClosed":true,"closesNextDay":false},{"dayOfWeek":4,"openTime":null,"closeTime":null,"isClosed":true,"closesNextDay":false},{"dayOfWeek":5,"openTime":null,"closeTime":null,"isClosed":true,"closesNextDay":false},{"dayOfWeek":6,"openTime":null,"closeTime":null,"isClosed":true,"closesNextDay":false}]}
  }]
}'::jsonb;
$$;

select throws_ok($$select public.kc3_stage_overture_review(
  jsonb_set(pg_temp.dawn_batch(), '{records,0,identity,placeType}', '"cafe"'))$$,
  '23514', 'new row for relation "overture_review_batches" violates check constraint "overture_review_hours_rule_valid"',
  'direct JSON staging rejects a dawn-to-dusk rule for a non-park');
select throws_ok($$select public.kc3_stage_overture_review(
  jsonb_set(pg_temp.dawn_batch(), '{records,0,hours,ruleType}', '"other"'))$$,
  '23514', 'new row for relation "overture_review_batches" violates check constraint "overture_review_hours_rule_valid"',
  'direct JSON staging rejects an unsupported hours rule');
select public.kc3_stage_overture_review(pg_temp.dawn_batch());
set local role service_role;
select public.kc3_publish_overture_place(
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  :'target_updated_at'::timestamptz, true, true,
  'Fixture municipality and duplicate review');
reset role;

set local role anon;
select is((select count(*)::integer from public.list_public_place_summaries()
  where name = 'Dawn Park'), 0,
  'new dawn-to-dusk hours remain private pending eligibility review');
reset role;
update public.place_hours_eligibility_reviews
set reviewed_revision = hours_revision
where place_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

select is((select hours_evidence ->> 'ruleType' from public.place_publications
  where overture_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'), 'dawn_to_dusk',
  'publication ledger retains the explicit hours rule');
select is((select count(*)::integer from public.place_hours
  where place_id = (select place_id from public.place_publications
    where overture_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd')
    and is_closed), 7, 'compatibility rows remain closed rather than invented times');

set local role postgres;
select is((select hours_state::text from public.kc3_regular_hours_status(
  (select place_id from public.place_publications
    where overture_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  '2026-10-02 12:00:00-05'::timestamptz)), 'open',
  'server calculates a daytime dawn-to-dusk state');
select is((select hours_state::text from public.kc3_regular_hours_status(
  (select place_id from public.place_publications
    where overture_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  '2026-10-02 02:00:00-05'::timestamptz)), 'closed',
  'server calculates a nighttime dawn-to-dusk state');
reset role;

select place_id::text as park_place_id
from public.place_publications
where overture_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
\gset

set local role anon;
select is((select regular_hours_rule from public.list_public_place_summaries()
  where name = 'Dawn Park'), 'dawn_to_dusk',
  'anonymous summary exposes the rule label');
select is((select regular_hours_rule from public.get_public_place_detail(
  :'park_place_id'::uuid)), 'dawn_to_dusk',
  'anonymous detail exposes the rule label');
select is((select regular_hours_available from public.get_public_place_detail(
  :'park_place_id'::uuid)), true,
  'dawn-to-dusk is a usable hours policy');
select * from finish();
rollback;
