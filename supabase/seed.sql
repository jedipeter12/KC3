begin;

-- This is a deliberately conservative bootstrap seed, not an import job.
-- Stable UUIDs make reruns idempotent. Existing rows win every conflict so a
-- local reset can add missing seed records without replacing later curation.
create temporary table kc3_mvp_seed_places (
  id uuid primary key,
  name text not null,
  city text not null,
  address text not null,
  place_type public.place_type not null
) on commit drop;

insert into kc3_mvp_seed_places (id, name, city, address, place_type)
values
  (
    '6b633300-0000-4000-8000-000000000001',
    'Lenexa City Center Library',
    'Lenexa',
    '8778 Penrose Ln, Lenexa, KS 66219',
    'library'
  ),
  (
    '6b633300-0000-4000-8000-000000000002',
    'Black Dog Coffeehouse',
    'Lenexa',
    '12815 W 87th St Pkwy, Lenexa, KS 66215',
    'coffee_shop'
  ),
  (
    '6b633300-0000-4000-8000-000000000003',
    'Maps Coffee & Chocolate',
    'Lenexa',
    '13440 Santa Fe Trail Dr, Lenexa, KS 66215',
    'coffee_shop'
  ),
  (
    '6b633300-0000-4000-8000-000000000004',
    'Black Hoof Park',
    'Lenexa',
    '9053 Monticello Rd, Lenexa, KS 66220',
    'park'
  ),
  (
    '6b633300-0000-4000-8000-000000000005',
    'Sar-Ko-Par Trails Park',
    'Lenexa',
    '8801 Greenway Ln, Lenexa, KS 66215',
    'park'
  ),
  (
    '6b633300-0000-4000-8000-000000000006',
    'Blue Valley Library',
    'Overland Park',
    '9000 W 151st St, Overland Park, KS 66221',
    'library'
  ),
  (
    '6b633300-0000-4000-8000-000000000007',
    'Central Resource Library',
    'Overland Park',
    '9875 W 87th St, Overland Park, KS 66212',
    'library'
  ),
  (
    '6b633300-0000-4000-8000-000000000008',
    'Oak Park Library',
    'Overland Park',
    '9500 Bluejacket St, Overland Park, KS 66214',
    'library'
  ),
  (
    '6b633300-0000-4000-8000-000000000009',
    'Homer''s Coffee House',
    'Overland Park',
    '7126 W 80th St, Overland Park, KS 66204',
    'coffee_shop'
  ),
  (
    '6b633300-0000-4000-8000-000000000010',
    'Pilgrim Coffee Company',
    'Overland Park',
    '12643 Metcalf Ave, Overland Park, KS 66213',
    'coffee_shop'
  ),
  (
    '6b633300-0000-4000-8000-000000000011',
    'Olathe Downtown Library',
    'Olathe',
    '260 E Santa Fe St, Olathe, KS 66061',
    'library'
  ),
  (
    '6b633300-0000-4000-8000-000000000012',
    'Olathe Indian Creek Library',
    'Olathe',
    '16100 W 135th St, Olathe, KS 66062',
    'library'
  ),
  (
    '6b633300-0000-4000-8000-000000000013',
    'Sweet Tee''s Coffee Shop',
    'Olathe',
    '2063 E Santa Fe St, Olathe, KS 66062',
    'coffee_shop'
  ),
  (
    '6b633300-0000-4000-8000-000000000014',
    'Apogee Coffee & Draft',
    'Olathe',
    '670 N Central St, Olathe, KS 66061',
    'coffee_shop'
  ),
  (
    '6b633300-0000-4000-8000-000000000015',
    'Black Bob Park',
    'Olathe',
    '14500 W 151st St, Olathe, KS 66062',
    'park'
  );

insert into public.places (id, name, city, address, place_type)
select id, name, city, address, place_type
from kc3_mvp_seed_places as seed
where not exists (
  select 1
  from public.places as existing
  where lower(btrim(existing.name)) = lower(btrim(seed.name))
    and lower(btrim(existing.city)) = lower(btrim(seed.city))
    and lower(btrim(existing.address)) = lower(btrim(seed.address))
)
on conflict (id) do nothing;

-- Create only unknown/unverified KC3 detail shells. The full canonical match
-- prevents an unexpected UUID collision from attaching details to another row.
-- ON CONFLICT DO NOTHING ensures reruns preserve every KC3-curated field.
insert into public.place_details (place_id)
select existing.id
from kc3_mvp_seed_places as seed
join public.places as existing
  on existing.id = seed.id
  and existing.name = seed.name
  and existing.city = seed.city
  and existing.address = seed.address
  and existing.place_type = seed.place_type
on conflict (place_id) do nothing;

-- Google-owned fields and weekly hours are intentionally not guessed here.
-- They remain empty until a separately approved, source-aware workflow can
-- populate them with appropriate provenance and freshness metadata.

commit;
