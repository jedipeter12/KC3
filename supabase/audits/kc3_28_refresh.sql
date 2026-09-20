-- Read-only KC3-28 refresh audit. Run from a trusted PostgreSQL session after
-- each bounded write import. Save the aggregate row from the first run and
-- compare it with the immediate repeat; only provider observation timestamps
-- are expected to advance when provider facts and schedules are unchanged.

select
  count(distinct places.id) as canonical_places,
  count(distinct places.id) filter (where places.google_place_id is not null) as provider_backed_places,
  count(distinct google.place_id) as provider_rows,
  count(hours.id) filter (where hours.source = 'google') as google_hour_rows,
  count(distinct hours.place_id) filter (where hours.source = 'google') as places_with_google_hours,
  count(distinct hours.place_id) filter (
    where hours.source = 'google'
      and hours.source_observed_at < google.google_fetched_at
  ) as schedules_older_than_latest_fetch,
  count(distinct hours.place_id) filter (
    where hours.source = 'google'
      and hours.source_observed_at = google.google_fetched_at
  ) as schedules_changed_at_latest_fetch,
  count(hours.id) filter (where hours.source = 'kc3') as kc3_hour_rows,
  count(distinct details.place_id) as detail_rows,
  count(distinct details.place_id) filter (where details.last_verified_at is not null) as kc3_verified_detail_rows,
  min(google.google_fetched_at) as oldest_provider_fetch,
  max(google.google_fetched_at) as newest_provider_fetch
from public.places as places
left join public.place_google_data as google on google.place_id = places.id
left join public.place_details as details on details.place_id = places.id
left join public.place_hours as hours on hours.place_id = places.id;

select
  'duplicate canonical normalized name/address' as issue,
  regexp_replace(lower(places.name), '[^[:alnum:]]+', ' ', 'g') as normalized_name,
  regexp_replace(lower(places.address), '[^[:alnum:]]+', ' ', 'g') as normalized_address,
  count(*) as copies
from public.places as places
group by normalized_name, normalized_address
having count(*) > 1
order by normalized_name, normalized_address;

select
  'provider identity/provider row mismatch' as issue,
  places.id,
  places.name
from public.places as places
left join public.place_google_data as google on google.place_id = places.id
where (places.google_place_id is null) <> (google.place_id is null)
   or (places.google_place_id is not null and google.google_fetched_at is null)
order by places.id;

select
  'duplicate Google hour row' as issue,
  hours.place_id,
  hours.day_of_week,
  hours.open_time,
  hours.close_time,
  hours.is_closed,
  hours.closes_next_day,
  count(*) as copies
from public.place_hours as hours
where hours.source = 'google'
group by
  hours.place_id,
  hours.day_of_week,
  hours.open_time,
  hours.close_time,
  hours.is_closed,
  hours.closes_next_day
having count(*) > 1
order by hours.place_id, hours.day_of_week, hours.open_time;

select
  'Google hour observation is newer than provider fetch' as issue,
  hours.place_id,
  hours.source_observed_at,
  google.google_fetched_at
from public.place_hours as hours
join public.place_google_data as google on google.place_id = hours.place_id
where hours.source = 'google'
  and hours.source_observed_at > google.google_fetched_at
order by hours.place_id, hours.day_of_week, hours.open_time;

select
  (select count(*) from public.list_public_places()) as public_rpc_rows,
  count(*) filter (where places.status = 'active') as active_canonical_rows,
  count(*) filter (where places.status = 'temporarily_closed') as temporarily_closed_rows,
  count(*) filter (where places.status = 'permanently_closed') as permanently_closed_rows,
  count(*) filter (where places.status = 'hidden') as hidden_rows
from public.places as places;
