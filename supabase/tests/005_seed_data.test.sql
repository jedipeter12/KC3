begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(12);

create temporary table expected_mvp_seed_places (
  id uuid primary key,
  name text not null,
  city text not null,
  address text not null,
  place_type public.place_type not null
);

insert into expected_mvp_seed_places (id, name, city, address, place_type)
values
  ('6b633300-0000-4000-8000-000000000001', 'Lenexa City Center Library', 'Lenexa', '8778 Penrose Ln, Lenexa, KS 66219', 'library'),
  ('6b633300-0000-4000-8000-000000000002', 'Black Dog Coffeehouse', 'Lenexa', '12815 W 87th St Pkwy, Lenexa, KS 66215', 'coffee_shop'),
  ('6b633300-0000-4000-8000-000000000003', 'Maps Coffee & Chocolate', 'Lenexa', '13440 Santa Fe Trail Dr, Lenexa, KS 66215', 'coffee_shop'),
  ('6b633300-0000-4000-8000-000000000004', 'Black Hoof Park', 'Lenexa', '9053 Monticello Rd, Lenexa, KS 66220', 'park'),
  ('6b633300-0000-4000-8000-000000000005', 'Sar-Ko-Par Trails Park', 'Lenexa', '8801 Greenway Ln, Lenexa, KS 66215', 'park'),
  ('6b633300-0000-4000-8000-000000000006', 'Blue Valley Library', 'Overland Park', '9000 W 151st St, Overland Park, KS 66221', 'library'),
  ('6b633300-0000-4000-8000-000000000007', 'Central Resource Library', 'Overland Park', '9875 W 87th St, Overland Park, KS 66212', 'library'),
  ('6b633300-0000-4000-8000-000000000008', 'Oak Park Library', 'Overland Park', '9500 Bluejacket St, Overland Park, KS 66214', 'library'),
  ('6b633300-0000-4000-8000-000000000009', 'Homer''s Coffee House', 'Overland Park', '7126 W 80th St, Overland Park, KS 66204', 'coffee_shop'),
  ('6b633300-0000-4000-8000-000000000010', 'Pilgrim Coffee Company', 'Overland Park', '12643 Metcalf Ave, Overland Park, KS 66213', 'coffee_shop'),
  ('6b633300-0000-4000-8000-000000000011', 'Olathe Downtown Library', 'Olathe', '260 E Santa Fe St, Olathe, KS 66061', 'library'),
  ('6b633300-0000-4000-8000-000000000012', 'Olathe Indian Creek Library', 'Olathe', '16100 W 135th St, Olathe, KS 66062', 'library'),
  ('6b633300-0000-4000-8000-000000000013', 'Sweet Tee''s Coffee Shop', 'Olathe', '2063 E Santa Fe St, Olathe, KS 66062', 'coffee_shop'),
  ('6b633300-0000-4000-8000-000000000014', 'Apogee Coffee & Draft', 'Olathe', '670 N Central St, Olathe, KS 66061', 'coffee_shop'),
  ('6b633300-0000-4000-8000-000000000015', 'Black Bob Park', 'Olathe', '14500 W 151st St, Olathe, KS 66062', 'park');

select set_eq(
  $$ select id from public.places where id in (select id from expected_mvp_seed_places) $$,
  $$ select id from expected_mvp_seed_places $$,
  'all stable MVP seed identities are present'
);

select is(
  (
    select count(*)::integer
    from public.places as actual
    join expected_mvp_seed_places as expected using (id)
    where actual.name = expected.name
      and actual.city = expected.city
      and actual.address = expected.address
      and actual.place_type = expected.place_type
  ),
  15,
  'all seed identities retain their expected canonical values'
);

select results_eq(
  $$
    select city, count(*)::bigint
    from public.places
    where id in (select id from expected_mvp_seed_places)
    group by city
    order by city
  $$,
  $$ values ('Lenexa', 5::bigint), ('Olathe', 5::bigint), ('Overland Park', 5::bigint) $$,
  'the seed is evenly distributed across the three initial JoCo cities'
);

select results_eq(
  $$
    select place_type::text, count(*)::bigint
    from public.places
    where id in (select id from expected_mvp_seed_places)
    group by place_type
    order by place_type::text
  $$,
  $$ values ('coffee_shop', 6::bigint), ('library', 6::bigint), ('park', 3::bigint) $$,
  'the seed represents coffee shops, libraries, and parks'
);

select is(
  (
    select count(*)::integer
    from public.places
    where id in (select id from expected_mvp_seed_places)
      and status = 'active'
  ),
  15,
  'seeded places use the schema active default'
);

select is(
  (
    select count(*)::integer
    from public.place_details
    where place_id in (select id from expected_mvp_seed_places)
  ),
  15,
  'every seeded place has one KC3 detail shell'
);

select is(
  (
    select count(*)::integer
    from public.place_details
    where place_id in (select id from expected_mvp_seed_places)
      and outlets = 'unknown'
      and wifi = 'unknown'
      and work_suitability = 'unknown'
      and food_beverage = 'unknown'
      and phone_calls_allowed is null
      and bathroom_available is null
      and last_verified_at is null
  ),
  15,
  'KC3 details begin explicitly unknown and unverified'
);

select is(
  (
    select count(*)::integer
    from public.place_google_data
    where place_id in (select id from expected_mvp_seed_places)
  ),
  0,
  'the seed does not invent Google-owned data'
);

select is(
  (
    select count(*)::integer
    from public.place_hours
    where place_id in (select id from expected_mvp_seed_places)
  ),
  0,
  'the seed does not store volatile hours without source metadata'
);

select lives_ok(
  $$
    update public.place_details
    set seating_notes = 'Curator note', outlets = 'many', wifi = 'public'
    where place_id = '6b633300-0000-4000-8000-000000000001'
  $$,
  'a seeded detail shell remains available for KC3 curation'
);

select is(
  (
    select seating_notes
    from public.place_details
    where place_id = '6b633300-0000-4000-8000-000000000001'
  ),
  'Curator note',
  'KC3-curated text is stored in the KC3-owned table'
);

select ok(
  (
    select outlets = 'many' and wifi = 'public'
    from public.place_details
    where place_id = '6b633300-0000-4000-8000-000000000001'
  ),
  'KC3-curated classifications are stored independently of source data'
);

select * from finish();

rollback;
