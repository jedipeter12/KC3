begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(5);
alter table public.places disable trigger reject_google_place_id;
alter table public.place_google_data disable trigger reject_google_provider_copy;
alter table public.place_hours disable trigger reject_google_hours;
insert into public.places (id,name,city,address,place_type,google_place_id,
  latitude,longitude,time_zone)
values ('dddddddd-dddd-dddd-dddd-dddddddddddd','Old Google name','Lenexa',
  '9 Old St','cafe','old-provider-id',38.8,-94.8,'America/Chicago');
insert into public.place_google_data (place_id,google_name,google_address)
values ('dddddddd-dddd-dddd-dddd-dddddddddddd','Old Google name','9 Old St');
insert into public.place_details (place_id,seating_notes)
values ('dddddddd-dddd-dddd-dddd-dddddddddddd','KC3-owned protected detail');
insert into public.place_hours (place_id,day_of_week,open_time,close_time,
  source,source_observed_at) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd',0,'09:00','17:00','google',now()),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd',1,'10:00','18:00','kc3',now());
alter table public.places enable trigger reject_google_place_id;
alter table public.place_google_data enable trigger reject_google_provider_copy;
alter table public.place_hours enable trigger reject_google_hours;
select updated_at as version from public.places
  where id='dddddddd-dddd-dddd-dddd-dddddddddddd' \gset
set local role service_role;
select public.kc3_stage_overture_review('{
  "schemaVersion":1,"batchId":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
  "release":"2026-09-23.1","manifestSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "records":[{
    "overtureId":"ffffffff-ffff-ffff-ffff-ffffffffffff",
    "targetPlaceId":"dddddddd-dddd-dddd-dddd-dddddddddddd",
    "identity":{"name":"Reviewed name","city":"Lenexa","address":"1 New St","placeType":"cafe","status":"active","addressPrecision":"street_address","latitude":38.9,"longitude":-94.7,"timeZone":"America/Chicago","website":null,"postcode":null},
    "identityEvidence":{"sourceUrl":"https://docs.overturemaps.org/getting-data/duckdb/","observedOn":"2026-10-02","reuseBasis":"Overture license","notes":""},
    "source":{"id":"ffffffff-ffff-ffff-ffff-ffffffffffff","sources":[{"dataset":"meta","license":"CDLA-Permissive-2.0"}]},
    "hours":null
  }]
}'::jsonb);
do $$
begin
  perform public.kc3_publish_overture_place(
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '2000-01-01'::timestamptz, true, true,
    'Stale fixture version must be refused');
  raise exception 'stale target version accepted';
exception when serialization_failure then null;
end;
$$;
select public.kc3_publish_overture_place(
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'dddddddd-dddd-dddd-dddd-dddddddddddd', :'version'::timestamptz,
  true,true,'Matched fixture identity and municipality reviewed');
reset role;
select is((select name from public.places
  where id='dddddddd-dddd-dddd-dddd-dddddddddddd'),
  'Reviewed name', 'stable KC3 ID receives reviewed identity');
select is((select google_place_id from public.places
  where id='dddddddd-dddd-dddd-dddd-dddddddddddd'), null::text,
  'Google identifier is retired from matched place');
select is((select seating_notes from public.place_details
  where place_id='dddddddd-dddd-dddd-dddd-dddddddddddd'),
  'KC3-owned protected detail', 'KC3 detail remains exact');
select is((select count(*)::integer from public.place_google_data
  where place_id='dddddddd-dddd-dddd-dddd-dddddddddddd'), 0,
  'Google provider copy is removed');
select is((select string_agg(source::text, ',' order by source::text)
  from public.place_hours
  where place_id='dddddddd-dddd-dddd-dddd-dddddddddddd'),
  'kc3', 'KC3 hours survive while Google hours are removed');
select * from finish();
rollback;
