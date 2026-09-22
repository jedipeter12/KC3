begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(26);

select set_eq(
  $$
    select table_name::text
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
  $$,
  $$ values
    ('places'),
    ('place_google_data'),
    ('place_details'),
    ('place_hours'),
    ('place_overrides')
  $$,
  'the approved public tables exist without additional public tables'
);

select results_eq(
  $$
    select enumlabel::text collate "default"
    from pg_enum
    where enumtypid = 'public.place_type'::regtype
    order by enumsortorder
  $$,
  $$ values
    ('coffee_shop'),
    ('cafe'),
    ('boba_tea'),
    ('library'),
    ('coworking'),
    ('park')
  $$,
  'place_type contains the approved classifications'
);

select results_eq(
  $$
    select enumlabel::text collate "default"
    from pg_enum
    where enumtypid = 'public.place_status'::regtype
    order by enumsortorder
  $$,
  $$ values ('active'), ('temporarily_closed'), ('permanently_closed'), ('hidden') $$,
  'place_status contains the approved lifecycle states'
);

select results_eq(
  $$
    select enumlabel::text collate "default"
    from pg_enum
    where enumtypid = 'public.outlet_level'::regtype
    order by enumsortorder
  $$,
  $$ values ('none'), ('few'), ('many'), ('unknown') $$,
  'outlet_level preserves an explicit unknown value'
);

select results_eq(
  $$
    select enumlabel::text collate "default"
    from pg_enum
    where enumtypid = 'public.wifi_type'::regtype
    order by enumsortorder
  $$,
  $$ values ('public'), ('password_printed'), ('password_on_request'), ('none'), ('unknown') $$,
  'wifi_type contains the approved classifications'
);

select results_eq(
  $$
    select enumlabel::text collate "default"
    from pg_enum
    where enumtypid = 'public.work_suitability'::regtype
    order by enumsortorder
  $$,
  $$ values ('good'), ('okay'), ('poor'), ('unknown') $$,
  'work_suitability contains the approved classifications'
);

select results_eq(
  $$
    select enumlabel::text collate "default"
    from pg_enum
    where enumtypid = 'public.food_beverage_level'::regtype
    order by enumsortorder
  $$,
  $$ values ('none'), ('light'), ('full'), ('unknown') $$,
  'food_beverage_level contains the approved classifications'
);

select results_eq(
  $$
    select enumlabel::text collate "default"
    from pg_enum
    where enumtypid = 'public.hours_source'::regtype
    order by enumsortorder
  $$,
  $$ values ('google'), ('kc3') $$,
  'hours_source contains the approved ownership values'
);

select results_eq(
  $$
    select enumlabel::text collate "default"
    from pg_enum
    where enumtypid = 'public.address_precision'::regtype
    order by enumsortorder
  $$,
  $$ values ('street_address'), ('approximate'), ('unknown') $$,
  'address_precision carries exact, approximate, and unknown states'
);

select results_eq(
  $$
    select enumlabel::text collate "default"
    from pg_enum
    where enumtypid = 'public.regular_hours_state'::regtype
    order by enumsortorder
  $$,
  $$ values ('open'), ('closed'), ('unknown') $$,
  'regular_hours_state carries typed current-state values'
);

select results_eq(
  $$
    select enumlabel::text collate "default"
    from pg_enum
    where enumtypid = 'public.kc3_verification_state'::regtype
    order by enumsortorder
  $$,
  $$ values ('unverified'), ('current'), ('stale') $$,
  'kc3_verification_state separates unverified, current, and stale claims'
);

select set_eq(
  $$
    select column_name::text
    from information_schema.columns
    where table_schema = 'public' and table_name = 'places'
  $$,
  $$ values
    ('id'), ('name'), ('city'), ('address'), ('place_type'),
    ('google_place_id'), ('status'), ('latitude'), ('longitude'),
    ('time_zone'), ('moved_to_place_id'), ('address_precision'),
    ('created_at'), ('updated_at')
  $$,
  'places retains the approved canonical fields'
);

select set_eq(
  $$
    select column_name::text
    from information_schema.columns
    where table_schema = 'public' and table_name = 'place_google_data'
  $$,
  $$ values
    ('place_id'), ('google_name'), ('google_address'),
    ('google_website_uri'), ('google_maps_uri'), ('google_business_status'),
    ('google_primary_type'), ('google_types'), ('google_rating'),
    ('google_user_rating_count'), ('google_address_components'),
    ('google_latitude'), ('google_longitude'), ('google_time_zone'),
    ('google_moved_place_id'), ('google_price_level'),
    ('google_fetched_at'), ('created_at'), ('updated_at')
  $$,
  'place_google_data retains the approved source-owned fields'
);

select set_eq(
  $$
    select column_name::text
    from information_schema.columns
    where table_schema = 'public' and table_name = 'place_details'
  $$,
  $$ values
    ('place_id'), ('seating_notes'), ('outlets'), ('wifi'),
    ('work_suitability'), ('food_beverage'), ('phone_calls_allowed'),
    ('bathroom_available'), ('drive_thru_available'), ('drive_thru_only'),
    ('last_verified_at'), ('verification_notes'), ('created_at'), ('updated_at')
  $$,
  'place_details retains the approved KC3-owned fields'
);

select set_eq(
  $$
    select column_name::text
    from information_schema.columns
    where table_schema = 'public' and table_name = 'place_hours'
  $$,
  $$ values
    ('id'), ('place_id'), ('day_of_week'), ('open_time'), ('close_time'),
    ('is_closed'), ('closes_next_day'), ('source'), ('source_observed_at'),
    ('created_at'), ('updated_at')
  $$,
  'place_hours retains the approved schedule fields'
);

select set_eq(
  $$
    select column_name::text
    from information_schema.columns
    where table_schema = 'public' and table_name = 'place_overrides'
  $$,
  $$ values
    ('id'), ('place_id'), ('override_type'), ('effective_start_date'),
    ('effective_end_date'), ('override_value'), ('source'), ('note'),
    ('source_observed_at'), ('created_at'), ('updated_at')
  $$,
  'place_overrides stores the effective-dated KC3 override contract'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.places'::regclass and contype = 'p'
  ),
  'places has a primary key'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.place_google_data'::regclass and contype = 'p'
  ),
  'place_google_data has a shared primary key'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.place_details'::regclass and contype = 'p'
  ),
  'place_details has a shared primary key'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.place_hours'::regclass and contype = 'p'
  ),
  'place_hours has a primary key'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.place_overrides'::regclass and contype = 'p'
  ),
  'place_overrides has a primary key'
);

select is(
  (
    select count(*)::integer
    from pg_constraint
    where conrelid in (
      'public.place_google_data'::regclass,
      'public.place_details'::regclass,
      'public.place_hours'::regclass,
      'public.place_overrides'::regclass
    )
      and confrelid = 'public.places'::regclass
      and contype = 'f'
      and confdeltype = 'c'
  ),
  4,
  'all four dependent tables cascade when their place is deleted'
);

select is(
  (
    select count(*)::integer
    from pg_constraint
    where conrelid = 'public.places'::regclass and contype = 'u'
  ),
  1,
  'places has one uniqueness constraint for the optional Google Place ID'
);

select is(
  (
    select count(*)::integer
    from pg_constraint
    where conrelid = 'public.place_hours'::regclass and contype = 'c'
  ),
  3,
  'place_hours has weekday, open/closed, and interval-direction checks'
);

select is(
  (
    select count(*)::integer
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'places'
      and indexname in (
        'places_city_idx',
        'places_place_type_idx',
        'places_status_idx',
        'places_name_idx'
      )
  ),
  4,
  'places retains the indexes supporting its established lookup fields'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'place_hours'
      and indexname = 'place_hours_place_id_day_of_week_idx'
  ),
  'place_hours is indexed by place and weekday'
);

select * from finish();

rollback;
