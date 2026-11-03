begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(30);

select ok(
  has_function_privilege(
    'service_role',
    'public.kc3_search_places_for_details(text,text)',
    'execute'
  ),
  'service role can execute the operator search'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.kc3_upsert_place_details(uuid,jsonb)',
    'execute'
  ),
  'service role can execute the detail upsert'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.kc3_upsert_place_details(uuid,jsonb)',
    'execute'
  ),
  'anonymous clients cannot edit details'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.kc3_upsert_place_details(uuid,jsonb)',
    'execute'
  ),
  'authenticated clients cannot edit details'
);
select is(
  (select rolcanlogin from pg_roles where rolname = 'kc3_place_detail_operator'),
  false,
  'the detail function owner cannot log in'
);
select ok(
  not has_table_privilege('kc3_place_detail_operator', 'public.places', 'update'),
  'the detail owner cannot update canonical/provider identity'
);
select ok(
  not has_table_privilege(
    'kc3_place_detail_operator',
    'public.place_google_data',
    'insert, update, delete'
  ),
  'the detail owner cannot mutate provider metadata'
);
select ok(
  not has_table_privilege(
    'kc3_place_detail_operator',
    'public.place_hours',
    'insert, update, delete'
  ),
  'the detail owner cannot mutate hours'
);
select ok(
  not has_table_privilege(
    'kc3_place_detail_operator',
    'public.place_overrides',
    'insert, update, delete'
  ),
  'the detail owner cannot mutate overrides'
);
select ok(
  has_column_privilege(
    'kc3_place_detail_operator',
    'public.place_details',
    'outlets',
    'update'
  ),
  'the detail owner can update an approved KC3-owned field'
);

insert into public.places (
  id, name, city, address, place_type, google_place_id, status
) values
  ('25000000-0000-4000-8000-000000000001', 'Operator Coffee', 'Lenexa', '1 First St', 'coffee_shop', 'operator-google-1', 'active'),
  ('25000000-0000-4000-8000-000000000002', 'Operator Coffee', 'Lenexa', '2 Second St', 'cafe', 'operator-google-2', 'active'),
  ('25000000-0000-4000-8000-000000000003', 'Operator Coffee', 'Lenexa', '3 Closed St', 'cafe', 'operator-google-3', 'hidden'),
  ('25000000-0000-4000-8000-000000000004', 'Operator Coffee', 'Lenexa', '4 Unbacked St', 'cafe', null, 'active'),
  ('25000000-0000-4000-8000-000000000005', 'Operator Coffee OP', 'Overland Park', '5 Metcalf Ave', 'coffee_shop', 'operator-google-5', 'active'),
  ('25000000-0000-4000-8000-000000000006', 'Operator Coffee Olathe', 'Olathe', '6 Santa Fe St', 'coffee_shop', 'operator-google-6', 'active');

insert into public.place_google_data (
  place_id, google_name, google_address, google_business_status,
  google_fetched_at
) values
  ('25000000-0000-4000-8000-000000000001', 'Google Operator Coffee', '1 First St, Lenexa, KS', 'OPERATIONAL', '2026-09-24T12:00:00Z'),
  ('25000000-0000-4000-8000-000000000002', 'Google Operator Coffee South', '2 Second St, Lenexa, KS', 'OPERATIONAL', '2026-09-24T12:00:00Z'),
  ('25000000-0000-4000-8000-000000000003', 'Hidden Operator Coffee', '3 Closed St, Lenexa, KS', 'OPERATIONAL', '2026-09-24T12:00:00Z'),
  ('25000000-0000-4000-8000-000000000005', 'Google Operator Coffee OP', '5 Metcalf Ave, Overland Park, KS', 'OPERATIONAL', '2026-09-24T12:00:00Z'),
  ('25000000-0000-4000-8000-000000000006', 'Google Operator Coffee Olathe', '6 Santa Fe St, Olathe, KS', 'OPERATIONAL', '2026-09-24T12:00:00Z');

insert into public.place_details (
  place_id, seating_notes, outlets, wifi, work_suitability, food_beverage,
  phone_calls_allowed, bathroom_available, drive_thru_available,
  drive_thru_only, last_verified_at, verification_notes
) values (
  '25000000-0000-4000-8000-000000000002', null, 'few', 'unknown',
  'unknown', 'unknown', null, true, null, null, '2026-01-01',
  'Prior partial verification'
);

insert into public.place_hours (
  place_id, day_of_week, open_time, close_time, is_closed,
  closes_next_day, source, source_observed_at
) values (
  '25000000-0000-4000-8000-000000000001', 1, '08:00', '17:00', false,
  false, 'google', '2026-09-24T12:00:00Z'
);

create temporary table protected_before as
select
  (select to_jsonb(p) from public.places p where id = '25000000-0000-4000-8000-000000000001') as place_row,
  (select to_jsonb(g) from public.place_google_data g where place_id = '25000000-0000-4000-8000-000000000001') as google_row,
  (select jsonb_agg(to_jsonb(h) order by h.id) from public.place_hours h where place_id = '25000000-0000-4000-8000-000000000001') as hour_rows;

select is(
  jsonb_array_length(public.kc3_search_places_for_details('operator', 'lenexa')),
  2,
  'search returns duplicate-looking active provider-backed records'
);
select is(
  public.kc3_search_places_for_details('operator', 'Lenexa') #>> '{0,address}',
  '1 First St',
  'search orders and exposes canonical address for selection'
);
select is(
  public.kc3_search_places_for_details('operator', 'Lenexa') #>> '{1,googleAddress}',
  '2 Second St, Lenexa, KS',
  'search exposes bounded provider identity context'
);
select set_eq(
  $$
    select jsonb_object_keys(
      public.kc3_search_places_for_details('operator', 'Lenexa') -> 0
    )
  $$,
  $$
    values
      ('id'), ('name'), ('city'), ('address'), ('placeType'),
      ('googlePlaceId'), ('googleName'), ('googleAddress'),
      ('googleBusinessStatus'), ('googleFetchedAt'), ('detailUpdatedAt'),
      ('details')
  $$,
  'search exposes only the bounded selection and KC3 detail context'
);
select is(
  jsonb_array_length(public.kc3_search_places_for_details('operator', 'Olathe')),
  1,
  'search finds the representative Olathe record'
);
select is(
  jsonb_array_length(public.kc3_search_places_for_details('operator', 'Overland Park')),
  1,
  'search finds the representative Overland Park record'
);
select is(
  jsonb_array_length(public.kc3_search_places_for_details('operator', 'Shawnee')),
  0,
  'search requires the requested city and returns an empty result predictably'
);

select lives_ok(
  $sql$
    select public.kc3_upsert_place_details(
      '25000000-0000-4000-8000-000000000001',
      '{
        "expectedUpdatedAt":null,
        "details":{
          "seatingNotes":"Indoor and patio seating",
          "outlets":"many",
          "wifi":"public",
          "workSuitability":"good",
          "foodBeverage":"light",
          "phoneCallsAllowed":true,
          "bathroomAvailable":null,
          "driveThruAvailable":true,
          "driveThruOnly":false,
          "lastVerifiedAt":"2026-09-24",
          "verificationNotes":"Observed in person"
        }
      }'::jsonb
    )
  $sql$,
  'a missing detail row is created atomically'
);
select is(
  (select outlets::text from public.place_details where place_id = '25000000-0000-4000-8000-000000000001'),
  'many',
  'created classifications are stored exactly'
);
select ok(
  (
    select bathroom_available is null
      and drive_thru_available is true
      and drive_thru_only is false
      and last_verified_at = '2026-09-24'::date
    from public.place_details
    where place_id = '25000000-0000-4000-8000-000000000001'
  ),
  'nullable unknowns, separate drive-thru facts, and verification date are preserved'
);
select ok(
  (select to_jsonb(p) from public.places p where id = '25000000-0000-4000-8000-000000000001') = (select place_row from protected_before)
  and (select to_jsonb(g) from public.place_google_data g where place_id = '25000000-0000-4000-8000-000000000001') = (select google_row from protected_before)
  and (select jsonb_agg(to_jsonb(h) order by h.id) from public.place_hours h where place_id = '25000000-0000-4000-8000-000000000001') = (select hour_rows from protected_before),
  'detail creation leaves identity, provider metadata, and hours unchanged'
);

select lives_ok(
  format(
    $sql$
      select public.kc3_upsert_place_details(
        '25000000-0000-4000-8000-000000000002',
        %L::jsonb
      )
    $sql$,
    jsonb_build_object(
      'expectedUpdatedAt', (select updated_at::text from public.place_details where place_id = '25000000-0000-4000-8000-000000000002'),
      'details', jsonb_build_object(
        'seatingNotes', null,
        'outlets', 'many',
        'wifi', 'unknown',
        'workSuitability', 'unknown',
        'foodBeverage', 'unknown',
        'phoneCallsAllowed', null,
        'bathroomAvailable', true,
        'driveThruAvailable', null,
        'driveThruOnly', null,
        'lastVerifiedAt', '2026-09-24',
        'verificationNotes', 'Refreshed partial verification'
      )
    )::text
  ),
  'a partially populated detail row can be updated and re-verified'
);
select ok(
  (
    select outlets = 'many'
      and wifi = 'unknown'
      and phone_calls_allowed is null
      and drive_thru_available is null
      and last_verified_at = '2026-09-24'
    from public.place_details
    where place_id = '25000000-0000-4000-8000-000000000002'
  ),
  'partial update retains explicit enum and nullable unknown states'
);

create temporary table detail_before_failure as
select to_jsonb(d) as detail_row
from public.place_details d
where place_id = '25000000-0000-4000-8000-000000000001';

select throws_ok(
  $sql$
    select public.kc3_upsert_place_details(
      '25000000-0000-4000-8000-000000000001',
      '{"expectedUpdatedAt":null,"name":"Protected","details":{}}'::jsonb
    )
  $sql$,
  '22023',
  'detail payload has unsupported or missing fields',
  'protected identity fields are rejected at the function boundary'
);
select is(
  (select to_jsonb(d) from public.place_details d where place_id = '25000000-0000-4000-8000-000000000001'),
  (select detail_row from detail_before_failure),
  'a rejected protected-field payload makes no partial detail change'
);
select throws_ok(
  $sql$
    select public.kc3_upsert_place_details(
      '25000000-0000-4000-8000-000000000001',
      jsonb_build_object(
        'expectedUpdatedAt', (select updated_at::text from public.place_details where place_id = '25000000-0000-4000-8000-000000000001'),
        'details', jsonb_build_object(
          'seatingNotes', null, 'outlets', 'lots', 'wifi', 'unknown',
          'workSuitability', 'unknown', 'foodBeverage', 'unknown',
          'phoneCallsAllowed', null, 'bathroomAvailable', null,
          'driveThruAvailable', null, 'driveThruOnly', null,
          'lastVerifiedAt', null, 'verificationNotes', null
        )
      )
    )
  $sql$,
  '22023',
  'detail classification is invalid',
  'unsupported enum values are rejected'
);
select throws_ok(
  $sql$
    select public.kc3_upsert_place_details(
      '25000000-0000-4000-8000-000000000001',
      jsonb_build_object(
        'expectedUpdatedAt', (select updated_at::text from public.place_details where place_id = '25000000-0000-4000-8000-000000000001'),
        'details', jsonb_build_object(
          'seatingNotes', null, 'outlets', 'unknown', 'wifi', 'unknown',
          'workSuitability', 'unknown', 'foodBeverage', 'unknown',
          'phoneCallsAllowed', null, 'bathroomAvailable', null,
          'driveThruAvailable', false, 'driveThruOnly', true,
          'lastVerifiedAt', null, 'verificationNotes', null
        )
      )
    )
  $sql$,
  '23514',
  'drive-thru-only requires drive-thru availability',
  'invalid drive-thru combinations are rejected'
);
select throws_ok(
  $sql$
    select public.kc3_upsert_place_details(
      '25000000-0000-4000-8000-000000000001',
      '{"expectedUpdatedAt":null,"details":{"outlets":"unknown"}}'::jsonb
    )
  $sql$,
  '22023',
  'detail values have unsupported or missing fields',
  'partial unchecked payloads cannot bypass the complete validated snapshot'
);
select throws_ok(
  format(
    $sql$
      select public.kc3_upsert_place_details(
        '25000000-0000-4000-8000-000000000001',
        %L::jsonb
      )
    $sql$,
    jsonb_build_object(
      'expectedUpdatedAt', '2000-01-01 00:00:00+00',
      'details', jsonb_build_object(
        'seatingNotes', null, 'outlets', 'unknown', 'wifi', 'unknown',
        'workSuitability', 'unknown', 'foodBeverage', 'unknown',
        'phoneCallsAllowed', null, 'bathroomAvailable', null,
        'driveThruAvailable', null, 'driveThruOnly', null,
        'lastVerifiedAt', null, 'verificationNotes', null
      )
    )::text
  ),
  '40001',
  'place details changed after selection',
  'stale operator selections cannot overwrite a newer detail row'
);
select is(
  (select to_jsonb(d) from public.place_details d where place_id = '25000000-0000-4000-8000-000000000001'),
  (select detail_row from detail_before_failure),
  'all failed validation and concurrency paths leave the row unchanged'
);

select * from finish();
rollback;
