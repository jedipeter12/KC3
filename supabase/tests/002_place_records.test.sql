begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(32);

select lives_ok(
  $$
    insert into public.places (
      id, name, city, address, place_type, google_place_id
    ) values (
      '10000000-0000-0000-0000-000000000001',
      'Main Library',
      'Kansas City',
      '14 W 10th St',
      'library',
      'google-main-library'
    )
  $$,
  'a place can be created with the required canonical data'
);

select is(
  (
    select status::text
    from public.places
    where id = '10000000-0000-0000-0000-000000000001'
  ),
  'active',
  'new places default to active'
);

select ok(
  (
    select created_at is not null and updated_at is not null
    from public.places
    where id = '10000000-0000-0000-0000-000000000001'
  ),
  'new places receive creation and update timestamps'
);

select throws_ok(
  $$ insert into public.places (name, city, address, place_type) values (null, 'Kansas City', '1 Main St', 'cafe') $$,
  '23502',
  null,
  'place name is required'
);

select throws_ok(
  $$ insert into public.places (name, city, address, place_type) values ('Cafe', null, '1 Main St', 'cafe') $$,
  '23502',
  null,
  'place city is required'
);

select throws_ok(
  $$ insert into public.places (name, city, address, place_type) values ('Cafe', 'Kansas City', null, 'cafe') $$,
  '23502',
  null,
  'place address is required'
);

select throws_ok(
  $$ insert into public.places (name, city, address, place_type) values ('Cafe', 'Kansas City', '1 Main St', null) $$,
  '23502',
  null,
  'place type is required'
);

select throws_ok(
  $$ insert into public.places (name, city, address, place_type, status) values ('Cafe', 'Kansas City', '1 Main St', 'cafe', null) $$,
  '23502',
  null,
  'place status cannot be null'
);

select throws_ok(
  $$
    insert into public.places (name, city, address, place_type, google_place_id)
    values ('Duplicate Library', 'Kansas City', '2 Main St', 'library', 'google-main-library')
  $$,
  '23505',
  null,
  'a non-null Google Place ID cannot identify two places'
);

select lives_ok(
  $$
    insert into public.places (name, city, address, place_type, google_place_id)
    values
      ('Unknown Google ID One', 'Kansas City', '3 Main St', 'cafe', null),
      ('Unknown Google ID Two', 'Kansas City', '4 Main St', 'coffee_shop', null)
  $$,
  'multiple places may omit the optional Google Place ID'
);

select is(
  (
    select count(distinct id)::integer
    from public.places
    where name like 'Unknown Google ID %'
  ),
  2,
  'omitted place IDs are independently generated'
);

select lives_ok(
  $$
    insert into public.place_details (place_id)
    values ('10000000-0000-0000-0000-000000000001')
  $$,
  'KC3 details can be added independently from canonical place creation'
);

select is(
  (select outlets::text from public.place_details where place_id = '10000000-0000-0000-0000-000000000001'),
  'unknown',
  'outlet availability defaults to unknown'
);

select is(
  (select wifi::text from public.place_details where place_id = '10000000-0000-0000-0000-000000000001'),
  'unknown',
  'Wi-Fi availability defaults to unknown'
);

select is(
  (select work_suitability::text from public.place_details where place_id = '10000000-0000-0000-0000-000000000001'),
  'unknown',
  'work suitability defaults to unknown'
);

select is(
  (select food_beverage::text from public.place_details where place_id = '10000000-0000-0000-0000-000000000001'),
  'unknown',
  'food and beverage availability defaults to unknown'
);

select is(
  (select phone_calls_allowed from public.place_details where place_id = '10000000-0000-0000-0000-000000000001'),
  null::boolean,
  'phone-call suitability defaults to unknown rather than false'
);

select is(
  (select bathroom_available from public.place_details where place_id = '10000000-0000-0000-0000-000000000001'),
  null::boolean,
  'bathroom availability defaults to unknown rather than false'
);

select throws_ok(
  $$ update public.place_details set outlets = null where place_id = '10000000-0000-0000-0000-000000000001' $$,
  '23502',
  null,
  'unknown outlet availability must use its explicit enum value rather than null'
);

select throws_ok(
  $$ update public.place_details set wifi = null where place_id = '10000000-0000-0000-0000-000000000001' $$,
  '23502',
  null,
  'unknown Wi-Fi availability must use its explicit enum value rather than null'
);

select throws_ok(
  $$ update public.place_details set work_suitability = null where place_id = '10000000-0000-0000-0000-000000000001' $$,
  '23502',
  null,
  'unknown work suitability must use its explicit enum value rather than null'
);

select throws_ok(
  $$ update public.place_details set food_beverage = null where place_id = '10000000-0000-0000-0000-000000000001' $$,
  '23502',
  null,
  'unknown food and beverage availability must use its explicit enum value rather than null'
);

select lives_ok(
  $$
    insert into public.place_google_data (
      place_id, google_rating, google_rating_count, raw_data
    ) values (
      '10000000-0000-0000-0000-000000000001',
      4.7,
      125,
      '{"source":"google","nested":{"open":true}}'::jsonb
    )
  $$,
  'Google-derived data can be stored separately from KC3 details'
);

select is(
  (select raw_data ->> 'source' from public.place_google_data where place_id = '10000000-0000-0000-0000-000000000001'),
  'google',
  'raw Google JSON is retained'
);

select is(
  (select google_rating from public.place_google_data where place_id = '10000000-0000-0000-0000-000000000001'),
  4.7::numeric,
  'Google rating precision is retained'
);

select throws_ok(
  $$ insert into public.place_details (place_id) values ('20000000-0000-0000-0000-000000000001') $$,
  '23503',
  null,
  'details cannot exist without a canonical place'
);

select throws_ok(
  $$ insert into public.place_google_data (place_id) values ('20000000-0000-0000-0000-000000000001') $$,
  '23503',
  null,
  'Google data cannot exist without a canonical place'
);

select throws_ok(
  $$ insert into public.place_details (place_id) values ('10000000-0000-0000-0000-000000000001') $$,
  '23505',
  null,
  'a place cannot have two KC3 detail records'
);

select throws_ok(
  $$ insert into public.place_google_data (place_id) values ('10000000-0000-0000-0000-000000000001') $$,
  '23505',
  null,
  'a place cannot have two Google data records'
);

select lives_ok(
  $$
    insert into public.place_hours (place_id, day_of_week, open_time, close_time, source)
    values ('10000000-0000-0000-0000-000000000001', 1, '09:00', '17:00', 'kc3')
  $$,
  'hours can reference the canonical place alongside both one-to-one records'
);

select lives_ok(
  $$ delete from public.places where id = '10000000-0000-0000-0000-000000000001' $$,
  'the canonical place can be deleted with dependent records present'
);

select is(
  (
    (select count(*) from public.place_details where place_id = '10000000-0000-0000-0000-000000000001')
    + (select count(*) from public.place_google_data where place_id = '10000000-0000-0000-0000-000000000001')
    + (select count(*) from public.place_hours where place_id = '10000000-0000-0000-0000-000000000001')
  ),
  0::bigint,
  'deleting a place cascades to details, Google data, and hours'
);

select * from finish();

rollback;
