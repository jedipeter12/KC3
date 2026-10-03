-- KC3-37 preparation only: aggregate inventory, with no content export or writes.
-- Run as a trusted administrator against the intended target. Counts identify
-- review candidates, not provenance, permissions, or migration eligibility.
begin transaction isolation level repeatable read read only;

select
  count(*) as places,
  count(*) filter (where status = 'active') as active_places,
  count(*) filter (where google_place_id is not null) as google_linked_places,
  count(*) filter (where latitude is not null or longitude is not null) as coordinate_pairs,
  count(*) filter (where time_zone is not null) as time_zones,
  count(*) filter (where moved_to_place_id is not null) as move_relationships
from public.places;

select
  count(*) as google_rows,
  count(*) filter (where places.name = google.google_name) as matching_canonical_names,
  count(*) filter (where places.address = google.google_address) as matching_canonical_addresses,
  count(*) filter (where places.latitude = google.google_latitude
    and places.longitude = google.google_longitude) as matching_canonical_coordinates,
  count(*) filter (where places.time_zone = google.google_time_zone) as matching_canonical_time_zones
from public.place_google_data as google
join public.places as places on places.id = google.place_id;

select source, count(*) as hour_rows, count(distinct place_id) as places_with_hours
from public.place_hours
group by source
order by source;

select
  count(*) as detail_rows,
  count(*) filter (where last_verified_at is not null) as dated_verification_rows,
  count(*) filter (where seating_notes is not null
    or verification_notes is not null
    or outlets <> 'unknown' or wifi <> 'unknown'
    or work_suitability <> 'unknown' or food_beverage <> 'unknown'
    or phone_calls_allowed is not null or bathroom_available is not null
    or drive_thru_available is not null or drive_thru_only is not null
    or last_verified_at is not null) as populated_detail_rows
from public.place_details;

select count(*) as override_rows from public.place_overrides;

select
  count(*) as correction_rows,
  count(distinct corrections.place_id) as corrected_places,
  count(*) filter (where before_values ->> 'name' = google.google_name
    or after_values ->> 'name' = google.google_name) as name_matches_current_google,
  count(*) filter (where before_values ->> 'address' = google.google_address
    or after_values ->> 'address' = google.google_address) as address_matches_current_google
from public.place_canonical_corrections as corrections
left join public.place_google_data as google on google.place_id = corrections.place_id;

-- Equality is only a review signal. Independently sourced facts can match
-- Google, and older Google-derived facts can differ from its current response.
-- Inspect every provider column's population without returning its contents.
select fields.key as provider_field, count(*) as populated_rows
from public.place_google_data as google
cross join lateral jsonb_each(to_jsonb(google)) as fields
where fields.key like 'google\_%' escape '\'
  and fields.value <> 'null'::jsonb
group by fields.key
order by fields.key;

rollback;
