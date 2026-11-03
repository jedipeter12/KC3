begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(25);

insert into public.places (
  id, name, city, address, place_type, google_place_id,
  latitude, longitude, time_zone
) values
  (
    '70000000-0000-0000-0000-000000000001',
    'Contract Cafe',
    'Lenexa',
    '1 Contract Way',
    'cafe',
    'google-contract-cafe',
    38.9536,
    -94.7336,
    'America/Chicago'
  ),
  (
    '70000000-0000-0000-0000-000000000002',
    'Moved Contract Cafe',
    'Olathe',
    '2 Contract Way',
    'cafe',
    'google-moved-contract-cafe',
    38.8814,
    -94.8191,
    'America/Chicago'
  );

select lives_ok(
  $$
    insert into public.place_google_data (
      place_id, google_name, google_address, google_address_components,
      google_latitude, google_longitude, google_business_status,
      google_primary_type, google_types, google_time_zone,
      google_moved_place_id, google_maps_uri, google_rating,
      google_user_rating_count, google_website_uri, google_price_level,
      google_fetched_at
    ) values (
      '70000000-0000-0000-0000-000000000001',
      'Contract Cafe',
      '1 Contract Way, Lenexa, KS',
      '[{"longText":"Lenexa","types":["locality"]}]'::jsonb,
      38.9536,
      -94.7336,
      'OPERATIONAL',
      'cafe',
      array['cafe', 'food'],
      'America/Chicago',
      null,
      'https://maps.google.com/example',
      4.7,
      125,
      'https://example.com',
      'PRICE_LEVEL_INEXPENSIVE',
      '2026-09-07 12:00:00+00'
    )
  $$,
  'all allowlisted Google values can be stored separately from canonical data'
);

select ok(
  (
    select google_address_components @> '[{"longText":"Lenexa"}]'::jsonb
      and google_types = array['cafe', 'food']
      and google_fetched_at = '2026-09-07 12:00:00+00'::timestamptz
    from public.place_google_data
    where place_id = '70000000-0000-0000-0000-000000000001'
  ),
  'structured provider metadata and provider freshness are retained'
);

select throws_ok(
  $$
    insert into public.places (name, city, address, place_type, latitude)
    values ('Bad Pair', 'Lenexa', '3 Contract Way', 'cafe', 38.9)
  $$,
  '23514',
  null,
  'canonical coordinates must be present as a pair'
);

select throws_ok(
  $$
    insert into public.places (name, city, address, place_type, latitude, longitude)
    values ('Bad Latitude', 'Lenexa', '4 Contract Way', 'cafe', 91, -94.7)
  $$,
  '23514',
  null,
  'canonical latitude is range checked'
);

select throws_ok(
  $$
    update public.place_google_data
    set google_longitude = null
    where place_id = '70000000-0000-0000-0000-000000000001'
  $$,
  '23514',
  null,
  'provider coordinates must be present as a pair'
);

select throws_ok(
  $$
    update public.place_google_data
    set google_longitude = 181
    where place_id = '70000000-0000-0000-0000-000000000001'
  $$,
  '23514',
  null,
  'provider longitude is range checked'
);

select throws_ok(
  $$
    update public.place_google_data
    set google_rating = 5.1
    where place_id = '70000000-0000-0000-0000-000000000001'
  $$,
  '23514',
  null,
  'provider rating must remain within the Google range'
);

select throws_ok(
  $$
    update public.place_google_data
    set google_user_rating_count = -1
    where place_id = '70000000-0000-0000-0000-000000000001'
  $$,
  '23514',
  null,
  'provider rating count cannot be negative'
);

select throws_ok(
  $$
    update public.place_google_data
    set google_business_status = 'NOT_A_GOOGLE_STATUS'
    where place_id = '70000000-0000-0000-0000-000000000001'
  $$,
  '23514',
  null,
  'unknown provider business statuses fail validation instead of corrupting state'
);

select throws_ok(
  $$
    update public.place_google_data
    set google_price_level = 'CHEAP'
    where place_id = '70000000-0000-0000-0000-000000000001'
  $$,
  '23514',
  null,
  'unknown provider price levels fail validation instead of corrupting state'
);

select throws_ok(
  $$
    update public.place_google_data
    set google_address_components = '{"locality":"Lenexa"}'::jsonb
    where place_id = '70000000-0000-0000-0000-000000000001'
  $$,
  '23514',
  null,
  'address components must retain the provider array shape'
);

select throws_ok(
  $$
    update public.places
    set moved_to_place_id = id
    where id = '70000000-0000-0000-0000-000000000001'
  $$,
  '23514',
  null,
  'a place cannot move to itself'
);

select lives_ok(
  $$
    update public.places
    set moved_to_place_id = '70000000-0000-0000-0000-000000000002'
    where id = '70000000-0000-0000-0000-000000000001'
  $$,
  'an old physical place can link to its new KC3 place'
);

insert into public.place_details (
  place_id, seating_notes, outlets, wifi, last_verified_at
) values (
  '70000000-0000-0000-0000-000000000001',
  'KC3-owned note',
  'many',
  'public',
  '2026-08-01'
);

update public.place_google_data
set google_name = 'Provider Refresh', google_fetched_at = '2026-09-08 12:00:00+00'
where place_id = '70000000-0000-0000-0000-000000000001';

select ok(
  (
    select seating_notes = 'KC3-owned note'
      and outlets = 'many'
      and wifi = 'public'
      and last_verified_at = '2026-08-01'
    from public.place_details
    where place_id = '70000000-0000-0000-0000-000000000001'
  ),
  'provider refreshes do not alter KC3-owned details or verification freshness'
);

insert into public.place_hours (
  place_id, day_of_week, open_time, close_time, source, source_observed_at
) values
  (
    '70000000-0000-0000-0000-000000000001',
    1,
    '08:00',
    '17:00',
    'google',
    '2026-09-08 12:00:00+00'
  ),
  (
    '70000000-0000-0000-0000-000000000001',
    1,
    '09:00',
    '16:00',
    'kc3',
    '2026-08-01 12:00:00+00'
  );

delete from public.place_hours
where place_id = '70000000-0000-0000-0000-000000000001'
  and source = 'google';

select is(
  (
    select count(*)::integer
    from public.place_hours
    where place_id = '70000000-0000-0000-0000-000000000001'
      and source = 'kc3'
  ),
  1,
  'a provider-hours replacement can target Google rows without destroying KC3 hours'
);

insert into public.place_overrides (
  place_id, override_type, effective_start_date, effective_end_date,
  override_value, source, note
) values (
  '70000000-0000-0000-0000-000000000001',
  'regular_hours.v1',
  '2026-09-07',
  '2026-09-08',
  '{"version":1,"rows":[{"dayOfWeek":1,"isClosed":true}]}'::jsonb,
  'operator',
  'Short closure'
);

select is(
  public.active_place_override_value(
    '70000000-0000-0000-0000-000000000001',
    'regular_hours.v1',
    '2026-09-09 04:30:00+00'
  ),
  '{"rows": [{"isClosed": true, "dayOfWeek": 1}], "version": 1}'::jsonb,
  'an override is active according to the place local date before local midnight'
);

select is(
  public.active_place_override_value(
    '70000000-0000-0000-0000-000000000001',
    'regular_hours.v1',
    '2026-09-09 05:30:00+00'
  ),
  null::jsonb,
  'an expired override returns null so reads fall back to current provider data'
);

select throws_ok(
  $$
    insert into public.place_overrides (
      place_id, override_type, effective_start_date, effective_end_date,
      override_value
    ) values (
      '70000000-0000-0000-0000-000000000001',
      'regular_hours.v1',
      '2026-09-08',
      '2026-09-10',
      '[]'::jsonb
    )
  $$,
  '23P01',
  null,
  'overlapping effective ranges for the same override type are rejected'
);

select throws_ok(
  $$
    insert into public.place_overrides (
      place_id, override_type, effective_start_date, effective_end_date,
      override_value
    ) values (
      '70000000-0000-0000-0000-000000000001',
      'name',
      '2026-09-10',
      '2026-09-09',
      '"Name"'::jsonb
    )
  $$,
  '23514',
  null,
  'override end dates cannot precede start dates'
);

select throws_ok(
  $$
    insert into public.place_overrides (
      place_id, override_type, effective_start_date, override_value
    ) values (
      '70000000-0000-0000-0000-000000000001',
      '   ',
      '2026-09-10',
      '"Name"'::jsonb
    )
  $$,
  '23514',
  null,
  'override types cannot be blank'
);

select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.place_overrides'::regclass
  ),
  'override rows are protected by row level security'
);

select ok(
  not exists (
    select 1
    from (values ('anon'), ('authenticated'), ('service_role')) as roles(role_name)
    cross join (values ('select'), ('insert'), ('update'), ('delete')) as privileges(privilege_name)
    where has_table_privilege(
      roles.role_name,
      'public.place_overrides',
      privileges.privilege_name
    )
  ),
  'Data API roles have no direct override privileges'
);

select ok(
  not exists (
    select 1
    from (values ('anon'), ('authenticated'), ('service_role')) as roles(role_name)
    where has_function_privilege(
      roles.role_name,
      'public.active_place_override_value(uuid,text,timestamptz)',
      'execute'
    )
  ),
  'Data API roles cannot execute the internal override resolver'
);

select ok(
  (
    select not prosecdef
      and provolatile = 's'
      and proconfig @> array['search_path=""']
    from pg_proc
    where oid = 'public.active_place_override_value(uuid,text,timestamptz)'::regprocedure
  ),
  'the override resolver uses invoker rights and an empty search path'
);

select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'place_google_data'
      and column_name in ('google_phone', 'raw_data')
  ),
  0,
  'the MVP contract has no phone or unrestricted raw payload storage columns'
);

select * from finish();

rollback;
