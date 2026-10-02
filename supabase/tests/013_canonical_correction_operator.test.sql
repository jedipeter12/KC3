begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(35);

select ok(
  has_function_privilege(
    'service_role',
    'public.kc3_search_places_for_canonical_correction(text,text)',
    'execute'
  ),
  'service role can execute canonical correction search'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.kc3_correct_canonical_place(uuid,jsonb)',
    'execute'
  ),
  'service role can execute canonical correction writes'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.kc3_correct_canonical_place(uuid,jsonb)',
    'execute'
  ),
  'anonymous clients cannot correct canonical places'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.kc3_correct_canonical_place(uuid,jsonb)',
    'execute'
  ),
  'authenticated clients cannot correct canonical places'
);
select ok(
  (
    select not rolcanlogin
      and not rolinherit
      and not rolsuper
      and not rolcreatedb
      and not rolcreaterole
      and not rolreplication
      and not rolbypassrls
    from pg_roles
    where rolname = 'kc3_canonical_correction_operator'
  ),
  'canonical correction owner is a hardened NOLOGIN role'
);
select ok(
  has_column_privilege(
    'kc3_canonical_correction_operator', 'public.places', 'name', 'update'
  )
  and has_column_privilege(
    'kc3_canonical_correction_operator', 'public.places', 'address', 'update'
  )
  and has_column_privilege(
    'kc3_canonical_correction_operator', 'public.places', 'address_precision', 'update'
  )
  and has_column_privilege(
    'kc3_canonical_correction_operator', 'public.places', 'place_type', 'update'
  ),
  'canonical correction owner can update exactly the approved canonical facts'
);
select ok(
  not has_column_privilege(
    'kc3_canonical_correction_operator', 'public.places', 'city', 'update'
  )
  and not has_column_privilege(
    'kc3_canonical_correction_operator', 'public.places', 'status', 'update'
  )
  and not has_column_privilege(
    'kc3_canonical_correction_operator', 'public.places', 'google_place_id', 'update'
  )
  and not has_column_privilege(
    'kc3_canonical_correction_operator', 'public.places', 'moved_to_place_id', 'update'
  ),
  'city, provider identity, lifecycle, and move state remain outside the write boundary'
);
select ok(
  not has_table_privilege(
    'kc3_canonical_correction_operator',
    'public.place_google_data',
    'insert, update, delete'
  ),
  'canonical correction owner cannot mutate provider metadata'
);
select ok(
  not has_table_privilege(
    'kc3_canonical_correction_operator',
    'public.place_details',
    'insert, update, delete'
  ),
  'canonical correction owner cannot mutate KC3 details'
);
select ok(
  not has_table_privilege(
    'kc3_canonical_correction_operator',
    'public.place_hours',
    'insert, update, delete'
  )
  and not has_table_privilege(
    'kc3_canonical_correction_operator',
    'public.place_overrides',
    'insert, update, delete'
  ),
  'canonical correction owner cannot mutate hours or overrides'
);
select ok(
  not has_table_privilege(
    'kc3_canonical_correction_operator',
    'public.place_canonical_corrections',
    'update, delete'
  ),
  'canonical correction evidence is immutable to its function owner'
);
select ok(
  not has_table_privilege(
    'service_role',
    'public.place_canonical_corrections',
    'select, insert, update, delete'
  ),
  'service role has no direct audit-table access'
);

insert into public.places (
  id, name, city, address, address_precision, place_type, google_place_id, status
) values
  ('29000000-0000-4000-8000-000000000001', 'Correction Park', 'Lenexa', 'W 93rd St & Greenway Ln', 'approximate', 'park', 'correction-google-1', 'active'),
  ('29000000-0000-4000-8000-000000000002', 'Correction Park', 'Lenexa', '2 Second St', 'street_address', 'park', 'correction-google-2', 'active'),
  ('29000000-0000-4000-8000-000000000003', 'Correction Park Hidden', 'Lenexa', '3 Hidden St', 'street_address', 'park', 'correction-google-3', 'hidden'),
  ('29000000-0000-4000-8000-000000000004', 'Correction Park Unbacked', 'Lenexa', '4 Unbacked St', 'street_address', 'park', null, 'active'),
  ('29000000-0000-4000-8000-000000000005', 'Correction Cafe', 'Olathe', '5 Santa Fe St', 'street_address', 'cafe', 'correction-google-5', 'active');

insert into public.place_google_data (
  place_id, google_name, google_address, google_primary_type, google_types,
  google_business_status, google_fetched_at
) values
  ('29000000-0000-4000-8000-000000000001', 'Correction Park RIGHT', 'W 93rd St & Greenway Ln, Lenexa, KS', 'park', array['park', 'point_of_interest'], 'OPERATIONAL', '2026-09-24T12:00:00Z'),
  ('29000000-0000-4000-8000-000000000002', 'Correction Park South', '2 Second St, Lenexa, KS', 'park', array['park'], 'OPERATIONAL', '2026-09-24T12:00:00Z'),
  ('29000000-0000-4000-8000-000000000003', 'Correction Park Hidden', '3 Hidden St, Lenexa, KS', 'park', array['park'], 'OPERATIONAL', '2026-09-24T12:00:00Z'),
  ('29000000-0000-4000-8000-000000000005', 'Correction Cafe', '5 Santa Fe St, Olathe, KS', 'cafe', array['cafe'], 'OPERATIONAL', '2026-09-24T12:00:00Z');

insert into public.place_details (place_id, outlets, verification_notes)
values ('29000000-0000-4000-8000-000000000001', 'few', 'Protected detail');

insert into public.place_hours (
  place_id, day_of_week, open_time, close_time, source
) values (
  '29000000-0000-4000-8000-000000000001', 1, '08:00', '17:00', 'google'
);

create temporary table correction_protected_before as
select
  (select to_jsonb(g) from public.place_google_data g where place_id = '29000000-0000-4000-8000-000000000001') as google_row,
  (select to_jsonb(d) from public.place_details d where place_id = '29000000-0000-4000-8000-000000000001') as detail_row,
  (select jsonb_agg(to_jsonb(h) order by h.id) from public.place_hours h where place_id = '29000000-0000-4000-8000-000000000001') as hour_rows;

select is(
  jsonb_array_length(
    public.kc3_search_places_for_canonical_correction('correction', 'lenexa')
  ),
  2,
  'search returns only active provider-backed records in the requested city'
);
select is(
  (
    select result ->> 'address'
    from jsonb_array_elements(
      public.kc3_search_places_for_canonical_correction('correction', 'Lenexa')
    ) as result
    where result ->> 'id' = '29000000-0000-4000-8000-000000000001'
  ),
  'W 93rd St & Greenway Ln',
  'search returns canonical address context in deterministic order'
);
select is(
  (
    select result ->> 'googleName'
    from jsonb_array_elements(
      public.kc3_search_places_for_canonical_correction('correction', 'Lenexa')
    ) as result
    where result ->> 'id' = '29000000-0000-4000-8000-000000000001'
  ),
  'Correction Park RIGHT',
  'search returns bounded provider identity context'
);
select is(
  public.kc3_search_places_for_canonical_correction('correction', 'Lenexa') #>> '{0,googleTypes,0}',
  'park',
  'search returns bounded provider type context'
);
select set_eq(
  $$
    select jsonb_object_keys(
      public.kc3_search_places_for_canonical_correction('correction', 'Lenexa') -> 0
    )
  $$,
  $$
    values
      ('id'), ('name'), ('city'), ('address'), ('addressPrecision'),
      ('placeType'), ('status'), ('placeUpdatedAt'), ('googlePlaceId'),
      ('googleName'), ('googleAddress'), ('googlePrimaryType'), ('googleTypes'),
      ('googleBusinessStatus'), ('googleFetchedAt')
  $$,
  'search exposes only canonical selection and bounded provider context'
);
select is(
  jsonb_array_length(
    public.kc3_search_places_for_canonical_correction('correction', 'Olathe')
  ),
  1,
  'search supports the other approved city'
);

select lives_ok(
  format(
    $sql$
      select public.kc3_correct_canonical_place(
        '29000000-0000-4000-8000-000000000001',
        %L::jsonb
      )
    $sql$,
    jsonb_build_object(
      'expectedUpdatedAt', (select updated_at::text from public.places where id = '29000000-0000-4000-8000-000000000001'),
      'canonical', jsonb_build_object(
        'name', 'Correction Park',
        'address', '9501 Greenway Lane, Lenexa, KS 66215',
        'addressPrecision', 'street_address',
        'placeType', 'park'
      ),
      'evidence', jsonb_build_object(
        'sourceUrl', 'https://www.lenexa.com/parks/correction-park',
        'observedOn', '2026-09-29',
        'notes', 'Official city page confirms the corrected street address.'
      )
    )::text
  ),
  'a reviewed complete canonical correction commits atomically'
);
select ok(
  (
    select address = '9501 Greenway Lane, Lenexa, KS 66215'
      and address_precision = 'street_address'
      and name = 'Correction Park'
      and place_type = 'park'
    from public.places
    where id = '29000000-0000-4000-8000-000000000001'
  ),
  'only the submitted canonical values are stored'
);
select ok(
  (select to_jsonb(g) from public.place_google_data g where place_id = '29000000-0000-4000-8000-000000000001') = (select google_row from correction_protected_before)
  and (select to_jsonb(d) from public.place_details d where place_id = '29000000-0000-4000-8000-000000000001') = (select detail_row from correction_protected_before)
  and (select jsonb_agg(to_jsonb(h) order by h.id) from public.place_hours h where place_id = '29000000-0000-4000-8000-000000000001') = (select hour_rows from correction_protected_before),
  'canonical correction leaves provider metadata, details, and hours unchanged'
);
select is(
  (select count(*)::integer from public.place_canonical_corrections where place_id = '29000000-0000-4000-8000-000000000001'),
  1,
  'successful correction writes exactly one evidence row'
);
select ok(
  (
    select before_values ->> 'address' = 'W 93rd St & Greenway Ln'
      and before_values ->> 'addressPrecision' = 'approximate'
      and after_values ->> 'address' = '9501 Greenway Lane, Lenexa, KS 66215'
      and after_values ->> 'addressPrecision' = 'street_address'
      and source_url = 'https://www.lenexa.com/parks/correction-park'
      and source_observed_on = '2026-09-29'::date
      and correction_notes = 'Official city page confirms the corrected street address.'
    from public.place_canonical_corrections
    where place_id = '29000000-0000-4000-8000-000000000001'
  ),
  'audit row stores exact before/after values and required evidence'
);
select is(
  (
    select result ->> 'address'
    from jsonb_array_elements(
      public.kc3_search_places_for_canonical_correction('correction', 'Lenexa')
    ) as result
    where result ->> 'id' = '29000000-0000-4000-8000-000000000001'
  ),
  '9501 Greenway Lane, Lenexa, KS 66215',
  'subsequent search returns the corrected canonical value'
);

select throws_ok(
  $$
    select public.kc3_correct_canonical_place(
      '29000000-0000-4000-8000-000000000002',
      '{"expectedUpdatedAt":"x","canonical":{},"evidence":{},"extra":true}'::jsonb
    )
  $$,
  '22023',
  null,
  'unsupported payload fields are rejected'
);
select throws_ok(
  format(
    $sql$
      select public.kc3_correct_canonical_place(
        '29000000-0000-4000-8000-000000000002',
        %L::jsonb
      )
    $sql$,
    jsonb_build_object(
      'expectedUpdatedAt', (select updated_at::text from public.places where id = '29000000-0000-4000-8000-000000000002'),
      'canonical', jsonb_build_object('name', 'Correction Park South', 'address', 'Changed', 'addressPrecision', 'unknown', 'placeType', 'restaurant'),
      'evidence', jsonb_build_object('sourceUrl', 'https://example.gov/place', 'observedOn', '2026-09-29', 'notes', 'Evidence')
    )::text
  ),
  '22023',
  null,
  'unsupported canonical classifications are rejected'
);
select throws_ok(
  format(
    $sql$
      select public.kc3_correct_canonical_place(
        '29000000-0000-4000-8000-000000000002',
        %L::jsonb
      )
    $sql$,
    jsonb_build_object(
      'expectedUpdatedAt', (select updated_at::text from public.places where id = '29000000-0000-4000-8000-000000000002'),
      'canonical', jsonb_build_object('name', 'Correction Park South', 'address', 'Changed', 'addressPrecision', 'unknown', 'placeType', 'park'),
      'evidence', jsonb_build_object('sourceUrl', 'http://example.gov/place', 'observedOn', '2026-09-29', 'notes', 'Evidence')
    )::text
  ),
  '22023',
  null,
  'non-HTTPS evidence URLs are rejected'
);
select throws_ok(
  format(
    $sql$
      select public.kc3_correct_canonical_place(
        '29000000-0000-4000-8000-000000000002',
        %L::jsonb
      )
    $sql$,
    jsonb_build_object(
      'expectedUpdatedAt', (select updated_at::text from public.places where id = '29000000-0000-4000-8000-000000000002'),
      'canonical', jsonb_build_object('name', 'Correction Park', 'address', '2 Second St', 'addressPrecision', 'street_address', 'placeType', 'park'),
      'evidence', jsonb_build_object('sourceUrl', 'https://example.gov/place', 'observedOn', '2026-09-29', 'notes', 'No actual change')
    )::text
  ),
  '22023',
  null,
  'a no-op correction is rejected'
);
select throws_ok(
  $$
    select public.kc3_correct_canonical_place(
      '29000000-0000-4000-8000-000000000002',
      '{
        "expectedUpdatedAt":"2000-01-01 00:00:00+00",
        "canonical":{"name":"Changed","address":"2 Second St","addressPrecision":"street_address","placeType":"park"},
        "evidence":{"sourceUrl":"https://example.gov/place","observedOn":"2026-09-29","notes":"Evidence"}
      }'::jsonb
    )
  $$,
  '40001',
  null,
  'a stale canonical snapshot is rejected'
);
select throws_ok(
  $$
    select public.kc3_correct_canonical_place(
      '29000000-0000-4000-8000-000000000003',
      '{
        "expectedUpdatedAt":"2000-01-01 00:00:00+00",
        "canonical":{"name":"Changed","address":"3 Hidden St","addressPrecision":"street_address","placeType":"park"},
        "evidence":{"sourceUrl":"https://example.gov/place","observedOn":"2026-09-29","notes":"Evidence"}
      }'::jsonb
    )
  $$,
  'P0002',
  null,
  'hidden places are outside the correction boundary'
);
select throws_ok(
  $$
    select public.kc3_correct_canonical_place(
      '29000000-0000-4000-8000-000000000004',
      '{
        "expectedUpdatedAt":"2000-01-01 00:00:00+00",
        "canonical":{"name":"Changed","address":"4 Unbacked St","addressPrecision":"street_address","placeType":"park"},
        "evidence":{"sourceUrl":"https://example.gov/place","observedOn":"2026-09-29","notes":"Evidence"}
      }'::jsonb
    )
  $$,
  'P0002',
  null,
  'places without a provider identity are outside the correction boundary'
);
select ok(
  (
    select name = 'Correction Park'
      and address = '2 Second St'
      and address_precision = 'street_address'
      and place_type = 'park'
    from public.places
    where id = '29000000-0000-4000-8000-000000000002'
  )
  and not exists (
    select 1
    from public.place_canonical_corrections
    where place_id = '29000000-0000-4000-8000-000000000002'
  ),
  'rejected corrections leave canonical values and evidence history unchanged'
);

set local role anon;
select throws_ok(
  $$ select public.kc3_search_places_for_canonical_correction('correction', 'Lenexa') $$,
  '42501',
  null,
  'anonymous clients cannot search the operator boundary'
);
reset role;

set local role postgres;
grant kc3_canonical_correction_operator to postgres;
grant usage on schema extensions to kc3_canonical_correction_operator;
set local role kc3_canonical_correction_operator;
select throws_ok(
  $$ update public.places set city = 'Olathe' where id = '29000000-0000-4000-8000-000000000002' $$,
  '42501',
  null,
  'the constrained owner cannot update city directly'
);
select throws_ok(
  $$ select source_url from public.place_canonical_corrections $$,
  '42501',
  null,
  'the constrained owner cannot read audit history directly'
);
reset role;
set local role postgres;
revoke usage on schema extensions from kc3_canonical_correction_operator;
revoke kc3_canonical_correction_operator from postgres;
reset role;

select * from finish();

rollback;
