-- KC3-31 needs to present the place-local current day before the full weekly
-- schedule. Return only the derived weekday; keep the IANA timezone private.

drop function public.get_public_place_detail(uuid);

create function public.get_public_place_detail(target_place_id uuid)
returns table (
  id uuid,
  name text,
  city text,
  address text,
  address_precision public.address_precision,
  place_type public.place_type,
  regular_hours_available boolean,
  regular_hours_state public.regular_hours_state,
  regular_hours_next_transition_at timestamptz,
  regular_hours_observed_at timestamptz,
  place_local_day_of_week integer,
  regular_hours jsonb,
  seating_notes text,
  outlets public.outlet_level,
  wifi public.wifi_type,
  work_suitability public.work_suitability,
  food_beverage public.food_beverage_level,
  phone_calls_allowed boolean,
  bathroom_available boolean,
  drive_thru_available boolean,
  drive_thru_only boolean,
  kc3_last_verified_at date,
  kc3_verification_state public.kc3_verification_state
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    places.id,
    places.name,
    places.city,
    places.address,
    places.address_precision,
    places.place_type,
    hours_status.hours_available,
    hours_status.hours_state,
    hours_status.next_transition_at,
    hours_status.hours_observed_at,
    case when places.time_zone is null then null
      else extract(dow from now() at time zone places.time_zone)::integer
    end,
    coalesce(hours.regular_hours, '[]'::jsonb),
    details.seating_notes,
    coalesce(details.outlets, 'unknown'::public.outlet_level),
    coalesce(details.wifi, 'unknown'::public.wifi_type),
    coalesce(details.work_suitability, 'unknown'::public.work_suitability),
    coalesce(details.food_beverage, 'unknown'::public.food_beverage_level),
    details.phone_calls_allowed,
    details.bathroom_available,
    details.drive_thru_available,
    details.drive_thru_only,
    details.last_verified_at,
    case
      when details.place_id is null
        or details.last_verified_at is null
        or not (
          nullif(btrim(details.seating_notes), '') is not null
          or details.outlets <> 'unknown'
          or details.wifi <> 'unknown'
          or details.work_suitability <> 'unknown'
          or details.food_beverage <> 'unknown'
          or details.phone_calls_allowed is not null
          or details.bathroom_available is not null
          or details.drive_thru_available is not null
          or details.drive_thru_only is not null
        )
        or places.time_zone is null
        then 'unverified'::public.kc3_verification_state
      when details.last_verified_at
        < (now() at time zone places.time_zone)::date - 180
        then 'stale'::public.kc3_verification_state
      else 'current'::public.kc3_verification_state
    end
  from public.places as places
  left join public.place_details as details on details.place_id = places.id
  cross join lateral public.kc3_regular_hours_status(places.id, now())
    as hours_status
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'day_of_week', effective.day_of_week,
        'open_time', case when effective.open_time is null then null
          else to_char(effective.open_time, 'HH24:MI') end,
        'close_time', case when effective.close_time is null then null
          else to_char(effective.close_time, 'HH24:MI') end,
        'is_closed', effective.is_closed,
        'closes_next_day', effective.closes_next_day
      )
      order by effective.day_of_week, effective.open_time nulls last
    ) as regular_hours
    from public.kc3_effective_regular_hours(places.id, now()) as effective
  ) as hours on true
  where places.id = target_place_id
    and places.status = 'active';
$$;

revoke all on function public.get_public_place_detail(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.get_public_place_detail(uuid) to anon;

comment on function public.get_public_place_detail(uuid) is
  'Returns one bounded KC3-31 anonymous detail projection, including only a derived place-local weekday, for an active place ID.';

grant kc3_public_place_reader to postgres;
grant create on schema public to kc3_public_place_reader;
alter function public.get_public_place_detail(uuid)
  owner to kc3_public_place_reader;
revoke create on schema public from kc3_public_place_reader;
revoke kc3_public_place_reader from postgres;
