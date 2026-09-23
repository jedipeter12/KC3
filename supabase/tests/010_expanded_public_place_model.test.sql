begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(32);

insert into public.places (
  id, name, city, address, address_precision, place_type, status, time_zone
) values
  (
    'a0000000-0000-0000-0000-000000000001',
    'Expanded Contract Cafe',
    'Lenexa',
    '1 Contract Way',
    'street_address',
    'cafe',
    'active',
    'America/Chicago'
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'Inactive Contract Cafe',
    'Lenexa',
    '2 Contract Way',
    'street_address',
    'cafe',
    'hidden',
    'America/Chicago'
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'Always Open Contract Cafe',
    'Lenexa',
    '3 Contract Way',
    'street_address',
    'cafe',
    'active',
    'America/Chicago'
  ),
  (
    'a0000000-0000-0000-0000-000000000004',
    'Address Precision Contract Cafe',
    'Lenexa',
    '4 Contract Way',
    'unknown',
    'cafe',
    'active',
    'America/Chicago'
  );

insert into public.place_details (place_id, last_verified_at)
values (
  'a0000000-0000-0000-0000-000000000001',
  current_date
);

select throws_ok(
  $$
    update public.places
    set time_zone = 'Not/A-Time-Zone'
    where id = 'a0000000-0000-0000-0000-000000000001'
  $$,
  '23514',
  'time_zone must be a valid IANA timezone',
  'invalid canonical timezones are rejected at the write boundary'
);

select ok(
  not exists (
    select 1
    from pg_proc
    where oid in (
      'public.kc3_effective_regular_hours(uuid,timestamptz)'::regprocedure,
      'public.kc3_regular_hours_status(uuid,timestamptz)'::regprocedure,
      'public.list_public_place_summaries()'::regprocedure,
      'public.get_public_place_detail(uuid)'::regprocedure
    )
      and position('pg_timezone_names' in pg_get_functiondef(oid)) > 0
  ),
  'public read functions do not expand the timezone catalog per place'
);

select ok(
  (
    select drive_thru_available is null and drive_thru_only is null
    from public.place_details
    where place_id = 'a0000000-0000-0000-0000-000000000001'
  ),
  'drive-thru facts default independently to unknown'
);

select throws_ok(
  $$
    update public.place_details
    set drive_thru_only = true
    where place_id = 'a0000000-0000-0000-0000-000000000001'
  $$,
  '23514',
  null,
  'drive-thru-only true requires drive-thru availability true'
);

select lives_ok(
  $$
    update public.place_details
    set drive_thru_available = true, drive_thru_only = true
    where place_id = 'a0000000-0000-0000-0000-000000000001'
  $$,
  'the explicit true/true drive-thru combination is valid'
);

insert into public.place_google_data (
  place_id, google_address_components
) values (
  'a0000000-0000-0000-0000-000000000004',
  '[{"longText":"4","types":["street_number"]},{"longText":"Contract Way","types":["route"]}]'
);

select is(
  (
    select address_precision::text
    from public.places
    where id = 'a0000000-0000-0000-0000-000000000004'
  ),
  'street_address',
  'structured provider components initialize an unknown address precision'
);

update public.places
set address_precision = 'approximate'
where id = 'a0000000-0000-0000-0000-000000000004';

update public.place_google_data
set google_address_components = '[{"longText":"4","types":["street_number"]}]'
where place_id = 'a0000000-0000-0000-0000-000000000004';

select is(
  (
    select address_precision::text
    from public.places
    where id = 'a0000000-0000-0000-0000-000000000004'
  ),
  'approximate',
  'provider refreshes do not replace accepted KC3 address precision'
);

insert into public.place_hours (
  place_id, day_of_week, open_time, close_time, is_closed,
  closes_next_day, source, source_observed_at
)
select
  'a0000000-0000-0000-0000-000000000001',
  day_number,
  case when day_number = 1 then '08:00'::time else null end,
  case when day_number = 1 then '17:00'::time else null end,
  day_number <> 1,
  false,
  'google',
  '2026-09-07 15:00:00+00'
from generate_series(0, 6) as days(day_number);

insert into public.place_hours (
  place_id, day_of_week, open_time, close_time, is_closed,
  closes_next_day, source, source_observed_at
)
select
  'a0000000-0000-0000-0000-000000000003',
  day_number,
  '00:00'::time,
  '00:00'::time,
  false,
  true,
  'google',
  '2026-09-21 15:00:00+00'
from generate_series(0, 6) as days(day_number);

select is(
  (
    select pg_get_userbyid(proowner)
    from pg_proc
    where oid = 'public.list_public_place_summaries()'::regprocedure
  ),
  'kc3_public_place_reader',
  'the summary RPC is owned by the constrained public reader'
);

select is(
  (
    select pg_get_userbyid(proowner)
    from pg_proc
    where oid = 'public.get_public_place_detail(uuid)'::regprocedure
  ),
  'kc3_public_place_reader',
  'the detail RPC is owned by the constrained public reader'
);

select ok(
  (
    select bool_and(prosecdef and provolatile = 's' and proconfig @> array['search_path=""'])
    from pg_proc
    where oid in (
      'public.list_public_place_summaries()'::regprocedure,
      'public.get_public_place_detail(uuid)'::regprocedure
    )
  ),
  'both expanded RPCs are stable security definers with empty search paths'
);

select ok(
  has_function_privilege('anon', 'public.list_public_place_summaries()', 'execute')
  and has_function_privilege('anon', 'public.get_public_place_detail(uuid)', 'execute'),
  'anonymous clients may execute both expanded RPCs'
);

select ok(
  not has_function_privilege('authenticated', 'public.list_public_place_summaries()', 'execute')
  and not has_function_privilege('service_role', 'public.list_public_place_summaries()', 'execute')
  and not has_function_privilege('authenticated', 'public.get_public_place_detail(uuid)', 'execute')
  and not has_function_privilege('service_role', 'public.get_public_place_detail(uuid)', 'execute'),
  'unapproved Data API roles cannot execute either expanded RPC'
);

select set_eq(
  $$
    select jsonb_object_keys(to_jsonb(summary))
    from (
      select *
      from public.list_public_place_summaries()
      limit 1
    ) as summary
  $$,
  $$ values
    ('id'), ('name'), ('city'), ('address'), ('address_precision'),
    ('place_type'), ('regular_hours_available'), ('regular_hours_state'),
    ('regular_hours_next_transition_at'), ('regular_hours_observed_at'),
    ('outlets'), ('wifi'), ('work_suitability'), ('food_beverage'),
    ('phone_calls_allowed'), ('bathroom_available'),
    ('drive_thru_available'), ('drive_thru_only'), ('kc3_last_verified_at'),
    ('kc3_verification_state')
  $$,
  'the summary RPC returns exactly the approved card and filter fields'
);

select set_eq(
  $$
    select jsonb_object_keys(to_jsonb(detail))
    from public.get_public_place_detail(
      'a0000000-0000-0000-0000-000000000001'
    ) as detail
  $$,
  $$ values
    ('id'), ('name'), ('city'), ('address'), ('address_precision'),
    ('place_type'), ('regular_hours_available'), ('regular_hours_state'),
    ('regular_hours_next_transition_at'), ('regular_hours_observed_at'),
    ('place_local_day_of_week'), ('regular_hours'), ('seating_notes'),
    ('outlets'), ('wifi'),
    ('work_suitability'), ('food_beverage'), ('phone_calls_allowed'),
    ('bathroom_available'), ('drive_thru_available'), ('drive_thru_only'),
    ('kc3_last_verified_at'), ('kc3_verification_state')
  $$,
  'the detail RPC returns exactly the approved identity, schedule, and KC3 fields'
);

select ok(
  (
    select outlets = 'unknown'
      and wifi = 'unknown'
      and work_suitability = 'unknown'
      and food_beverage = 'unknown'
      and phone_calls_allowed is null
      and bathroom_available is null
      and kc3_last_verified_at is null
      and kc3_verification_state = 'unverified'
      and not regular_hours_available
      and regular_hours_state = 'unknown'
      and regular_hours_observed_at is null
    from public.list_public_place_summaries()
    where id = '6b633300-0000-4000-8000-000000000001'
  ),
  'missing details and hours normalize to explicit unknown values'
);

select is(
  (
    select kc3_verification_state::text
    from public.list_public_place_summaries()
    where id = 'a0000000-0000-0000-0000-000000000001'
  ),
  'current',
  'known KC3 details with a current verification date carry a current state'
);

update public.place_details
set last_verified_at = (now() at time zone 'America/Chicago')::date - 180
where place_id = 'a0000000-0000-0000-0000-000000000001';

select is(
  (
    select kc3_verification_state::text
    from public.list_public_place_summaries()
    where id = 'a0000000-0000-0000-0000-000000000001'
  ),
  'current',
  'KC3 verification exactly 180 local calendar days old remains current'
);

update public.place_details
set last_verified_at = (now() at time zone 'America/Chicago')::date - 181
where place_id = 'a0000000-0000-0000-0000-000000000001';

select is(
  (
    select kc3_verification_state::text
    from public.list_public_place_summaries()
    where id = 'a0000000-0000-0000-0000-000000000001'
  ),
  'stale',
  'KC3 verification becomes stale after 180 local calendar days'
);

select is_empty(
  $$
    select *
    from public.get_public_place_detail(
      'a0000000-0000-0000-0000-000000000002'
    )
  $$,
  'inactive place IDs are indistinguishable from unknown IDs'
);

select is(
  (
    select count(*)::integer
    from public.get_public_place_detail(
      'a0000000-0000-0000-0000-000000000001'
    )
  ),
  1,
  'an active place ID returns exactly one detail record'
);

select is(
  (
    select effective_source
    from public.kc3_effective_regular_hours(
      'a0000000-0000-0000-0000-000000000001',
      '2026-09-21 15:00:00+00'
    )
    limit 1
  ),
  'google',
  'a complete Google schedule is the effective fallback source'
);

select is(
  (
    select hours_state::text
    from public.kc3_regular_hours_status(
      'a0000000-0000-0000-0000-000000000001',
      '2026-09-21 15:00:00+00'
    )
  ),
  'open',
  'fresh regular hours compute open state in the place timezone'
);

select is(
  (
    select next_transition_at
    from public.kc3_regular_hours_status(
      'a0000000-0000-0000-0000-000000000001',
      '2026-09-21 15:00:00+00'
    )
  ),
  '2026-09-21 22:00:00+00'::timestamptz,
  'open state returns the next closing instant'
);

select is(
  (
    select hours_state::text
    from public.kc3_regular_hours_status(
      'a0000000-0000-0000-0000-000000000001',
      '2026-09-21 15:00:00+00'
    )
  ),
  'open',
  'hours exactly fourteen days old remain current'
);

select is(
  (
    select hours_state::text
    from public.kc3_regular_hours_status(
      'a0000000-0000-0000-0000-000000000001',
      '2026-09-21 15:00:01+00'
    )
  ),
  'unknown',
  'hours become stale after fourteen full days'
);

insert into public.place_overrides (
  place_id, override_type, effective_start_date, effective_end_date,
  override_value, source_observed_at
) values (
  'a0000000-0000-0000-0000-000000000001',
  'regular_hours.v1',
  '2026-09-21',
  '2026-09-21',
  jsonb_build_object(
    'version', 1,
    'rows', (
      select jsonb_agg(
        jsonb_build_object(
          'dayOfWeek', day_number,
          'openTime', null,
          'closeTime', null,
          'isClosed', true,
          'closesNextDay', false
        ) order by day_number
      )
      from generate_series(0, 6) as days(day_number)
    )
  ),
  '2026-09-21 14:00:00+00'
);

select is(
  (
    select effective_source
    from public.kc3_effective_regular_hours(
      'a0000000-0000-0000-0000-000000000001',
      '2026-09-21 15:00:00+00'
    )
    limit 1
  ),
  'override',
  'an active complete regular-hours override has highest priority'
);

select is(
  (
    select effective_source
    from public.kc3_effective_regular_hours(
      'a0000000-0000-0000-0000-000000000001',
      '2026-09-22 15:00:00+00'
    )
    limit 1
  ),
  'google',
  'an expired override falls back without deleting provider hours'
);

insert into public.place_hours (
  place_id, day_of_week, is_closed, closes_next_day, source,
  source_observed_at
)
select
  'a0000000-0000-0000-0000-000000000001',
  day_number,
  true,
  false,
  'kc3',
  '2026-09-21 14:30:00+00'
from generate_series(0, 6) as days(day_number);

select is(
  (
    select effective_source
    from public.kc3_effective_regular_hours(
      'a0000000-0000-0000-0000-000000000001',
      '2026-09-22 15:00:00+00'
    )
    limit 1
  ),
  'kc3',
  'a complete KC3 base schedule takes priority over Google hours'
);

select ok(
  (
    select hours_state = 'open' and next_transition_at is null
    from public.kc3_regular_hours_status(
      'a0000000-0000-0000-0000-000000000003',
      '2026-09-21 15:00:00+00'
    )
  ),
  'a continuous midnight-to-midnight week is open without a false transition'
);

select is(
  (
    select jsonb_array_length(regular_hours)
    from public.get_public_place_detail(
      'a0000000-0000-0000-0000-000000000001'
    )
  ),
  7,
  'detail returns the complete effective weekly schedule'
);

set local role anon;

select lives_ok(
  $$ select * from public.list_public_place_summaries() $$,
  'anonymous clients can call the summary RPC'
);

select lives_ok(
  $$
    select *
    from public.get_public_place_detail(
      'a0000000-0000-0000-0000-000000000001'
    )
  $$,
  'anonymous clients can call the detail RPC'
);

reset role;

select * from finish();

rollback;
