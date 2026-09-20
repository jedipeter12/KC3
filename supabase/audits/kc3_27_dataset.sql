-- Read-only KC3-27 review queries. Run after the bounded provider import from a
-- trusted PostgreSQL session. Every result after the aggregate sections should
-- be empty unless the corresponding issue is reviewed and documented.

select
  places.city,
  places.place_type,
  count(*) as canonical_places,
  count(places.google_place_id) as provider_backed_places,
  count(*) filter (where places.status = 'active') as active_places
from public.places as places
where places.city in ('Lenexa', 'Overland Park', 'Olathe')
group by places.city, places.place_type
order by places.city, places.place_type;

select
  count(*) as total_canonical_places,
  count(google_place_id) as provider_backed_places,
  count(*) filter (where status = 'active') as active_places
from public.places;

select
  count(*) as representative_seed_places,
  count(google_place_id) as reconciled_seed_places
from public.places
where id between
  '6b633300-0000-4000-8000-000000000001'::uuid and
  '6b633300-0000-4000-8000-000000000015'::uuid;

select
  'representative seed has no provider identity' as issue,
  places.id,
  places.name,
  places.city,
  places.address,
  places.place_type
from public.places as places
where places.id between
  '6b633300-0000-4000-8000-000000000001'::uuid and
  '6b633300-0000-4000-8000-000000000015'::uuid
  and places.google_place_id is null
order by places.city, places.name;

select
  'provider identity or freshness missing' as issue,
  places.id,
  places.name,
  places.city
from public.places as places
left join public.place_google_data as google on google.place_id = places.id
where (places.google_place_id is null) <> (google.place_id is null)
   or (places.google_place_id is not null and google.google_fetched_at is null)
order by places.city, places.name;

select
  'unsupported or out-of-area canonical record' as issue,
  places.id,
  places.name,
  places.city,
  places.place_type
from public.places as places
where places.city not in ('Lenexa', 'Overland Park', 'Olathe')
   or places.place_type not in (
     'coffee_shop', 'cafe', 'boba_tea', 'library', 'coworking', 'park'
   )
order by places.city, places.name;

with comparable as (
  select
    places.*,
    regexp_replace(lower(places.name), '[^[:alnum:]]+', ' ', 'g') as normalized_name,
    regexp_replace(lower(places.address), '[^[:alnum:]]+', ' ', 'g') as normalized_address
  from public.places as places
)
select
  'duplicate canonical name and address' as issue,
  array_agg(comparable.id order by comparable.id) as place_ids,
  min(comparable.name) as example_name,
  min(comparable.address) as example_address,
  count(*) as copies
from comparable
group by comparable.normalized_name, comparable.normalized_address
having count(*) > 1
order by example_name;

select
  'nearby provider-backed records for manual duplicate review' as issue,
  first.id as first_place_id,
  first.name as first_name,
  second.id as second_place_id,
  second.name as second_name,
  round((
    6371000 * 2 * asin(sqrt(
      power(sin(radians(second.latitude - first.latitude) / 2), 2) +
      cos(radians(first.latitude)) * cos(radians(second.latitude)) *
      power(sin(radians(second.longitude - first.longitude) / 2), 2)
    ))
  )::numeric, 1) as distance_meters
from public.places as first
join public.places as second on first.id < second.id
where first.google_place_id is not null
  and second.google_place_id is not null
  and first.latitude is not null
  and first.longitude is not null
  and second.latitude is not null
  and second.longitude is not null
  and first.city = second.city
  and 6371000 * 2 * asin(sqrt(
    power(sin(radians(second.latitude - first.latitude) / 2), 2) +
    cos(radians(first.latitude)) * cos(radians(second.latitude)) *
    power(sin(radians(second.longitude - first.longitude) / 2), 2)
  )) <= 100
order by first.city, first.name, second.name;

select
  'malformed stored hours' as issue,
  hours.id,
  hours.place_id,
  hours.day_of_week,
  hours.open_time,
  hours.close_time,
  hours.is_closed,
  hours.closes_next_day,
  hours.source,
  hours.source_observed_at
from public.place_hours as hours
where hours.day_of_week not between 0 and 6
   or hours.source_observed_at is null
   or (hours.is_closed and (hours.open_time is not null or hours.close_time is not null))
   or (not hours.is_closed and (hours.open_time is null or hours.close_time is null))
order by hours.place_id, hours.day_of_week, hours.open_time;

select
  'unverified KC3 detail contains a claimed value' as issue,
  details.place_id,
  places.name
from public.place_details as details
join public.places as places on places.id = details.place_id
where details.last_verified_at is null
  and (
    details.seating_notes is not null
    or details.outlets <> 'unknown'
    or details.wifi <> 'unknown'
    or details.work_suitability <> 'unknown'
    or details.food_beverage <> 'unknown'
    or details.phone_calls_allowed is not null
    or details.bathroom_available is not null
    or details.verification_notes is not null
  )
order by places.city, places.name;

select
  places.city,
  places.place_type,
  count(*) filter (where hours.source = 'google') as google_hour_rows,
  count(distinct places.id) filter (where hours.source = 'google') as places_with_google_hours,
  count(distinct places.id) filter (where hours.source = 'kc3') as places_with_kc3_hours
from public.places as places
left join public.place_hours as hours on hours.place_id = places.id
group by places.city, places.place_type
order by places.city, places.place_type;
