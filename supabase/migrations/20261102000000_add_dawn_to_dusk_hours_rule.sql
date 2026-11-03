-- A dawn-to-dusk rule is a verified operating policy, not a fixed weekly
-- schedule. Parks may publish it without inventing seasonal clock times; the
-- server derives today's sunrise/sunset from the canonical coordinates.

create function public.kc3_solar_event_utc_minutes(
  local_date date,
  latitude double precision,
  longitude double precision,
  sunrise boolean
)
returns double precision
language plpgsql
immutable
set search_path = ''
as $$
declare
  day_number double precision := extract(doy from local_date);
  longitude_hour double precision := longitude / 15.0;
  approximate_time double precision;
  solar_mean_anomaly double precision;
  solar_longitude double precision;
  right_ascension double precision;
  right_ascension_quadrant double precision;
  longitude_quadrant double precision;
  sin_declination double precision;
  cos_declination double precision;
  cos_hour_angle double precision;
  hour_angle double precision;
  local_mean_time double precision;
  utc_hour double precision;
begin
  approximate_time := day_number +
    ((case when sunrise then 6.0 else 18.0 end - longitude_hour) / 24.0);
  solar_mean_anomaly := (0.9856 * approximate_time) - 3.289;
  solar_longitude := mod(
    (solar_mean_anomaly
      + (1.916 * sin(radians(solar_mean_anomaly)))
      + (0.020 * sin(radians(2.0 * solar_mean_anomaly)))
      + 282.634)::numeric,
    360.0::numeric
  )::double precision;
  if solar_longitude < 0 then
    solar_longitude := solar_longitude + 360.0;
  end if;

  right_ascension := degrees(atan(0.91764 * tan(radians(solar_longitude))));
  if right_ascension < 0 then
    right_ascension := right_ascension + 360.0;
  end if;
  longitude_quadrant := floor(solar_longitude / 90.0) * 90.0;
  right_ascension_quadrant := floor(right_ascension / 90.0) * 90.0;
  right_ascension := (
    right_ascension
      + longitude_quadrant
      - right_ascension_quadrant
  ) / 15.0;

  sin_declination := 0.39782 * sin(radians(solar_longitude));
  cos_declination := cos(asin(sin_declination));
  cos_hour_angle := (
    cos(radians(90.833))
      - (sin_declination * sin(radians(latitude)))
  ) / (cos_declination * cos(radians(latitude)));
  if (sunrise and cos_hour_angle > 1.0)
    or (not sunrise and cos_hour_angle < -1.0) then
    return null;
  end if;

  hour_angle := degrees(acos(cos_hour_angle));
  if sunrise then
    hour_angle := 360.0 - hour_angle;
  end if;
  hour_angle := hour_angle / 15.0;
  local_mean_time := hour_angle + right_ascension
    - (0.06571 * approximate_time) - 6.622;
  utc_hour := mod(
    (local_mean_time - longitude_hour)::numeric,
    24.0::numeric
  )::double precision;
  if utc_hour < 0 then
    utc_hour := utc_hour + 24.0;
  end if;
  return utc_hour * 60.0;
end;
$$;

revoke all on function public.kc3_solar_event_utc_minutes(
  date, double precision, double precision, boolean
) from public, anon, authenticated, service_role;
grant execute on function public.kc3_solar_event_utc_minutes(
  date, double precision, double precision, boolean
) to kc3_public_place_reader;

create function public.kc3_dawn_to_dusk_bounds(
  target_place_id uuid,
  local_date date
)
returns table (opens_at timestamptz, closes_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with event_minutes as (
    select
      public.kc3_solar_event_utc_minutes(
        local_date, places.latitude, places.longitude, true
      ) as sunrise_minutes,
      public.kc3_solar_event_utc_minutes(
        local_date, places.latitude, places.longitude, false
      ) as sunset_minutes
    from public.places as places
    where places.id = target_place_id
      and places.latitude is not null
      and places.longitude is not null
      and places.time_zone is not null
  )
  select
    (
      local_date::timestamp
        + (event_minutes.sunrise_minutes || ' minutes')::interval
    ) at time zone 'UTC',
    (
      local_date::timestamp
        + ((event_minutes.sunset_minutes +
            case when event_minutes.sunset_minutes < event_minutes.sunrise_minutes
              then 1440
              else 0
            end) || ' minutes')::interval
    ) at time zone 'UTC'
  from event_minutes
  where event_minutes.sunrise_minutes is not null
    and event_minutes.sunset_minutes is not null;
$$;

revoke all on function public.kc3_dawn_to_dusk_bounds(uuid, date)
from public, anon, authenticated, service_role;
grant execute on function public.kc3_dawn_to_dusk_bounds(uuid, date)
to kc3_public_place_reader;

create or replace function public.kc3_regular_hours_status(
  target_place_id uuid,
  at_instant timestamptz default now()
)
returns table (
  hours_available boolean,
  hours_state public.regular_hours_state,
  next_transition_at timestamptz,
  hours_observed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with recursive
  place_context as (
    select
      places.time_zone,
      places.latitude,
      places.longitude,
      (at_instant at time zone places.time_zone)::date as local_date
    from public.places as places
    where places.id = target_place_id
      and places.time_zone is not null
  ),
  rule_context as (
    select
      coalesce(publication.hours_evidence ->> 'ruleType', 'weekly') as rule,
      nullif(publication.hours_evidence ->> 'observedOn', '')::date::timestamptz
        as observed_at
    from public.place_publications as publication
    where publication.place_id = target_place_id
  ),
  dawn_dates as (
    select place_context.local_date + offsets.day_offset as schedule_date
    from place_context
    cross join generate_series(0, 8) as offsets(day_offset)
  ),
  dawn_bounds as (
    select
      dawn_dates.schedule_date,
      bounds.opens_at,
      bounds.closes_at
    from dawn_dates
    cross join lateral public.kc3_dawn_to_dusk_bounds(
      target_place_id, dawn_dates.schedule_date
    ) as bounds
  ),
  dawn_result as (
    select
      exists (select 1 from place_context)
        and exists (select 1 from dawn_bounds) as available,
      case
        when not exists (select 1 from place_context)
          or not exists (select 1 from dawn_bounds)
          or not exists (
            select 1 from rule_context where rule = 'dawn_to_dusk'
          )
          then 'unknown'::public.regular_hours_state
        when exists (
          select 1 from dawn_bounds
          where opens_at <= at_instant and closes_at > at_instant
        ) then 'open'::public.regular_hours_state
        else 'closed'::public.regular_hours_state
      end as state,
      case
        when exists (
          select 1 from dawn_bounds
          where opens_at <= at_instant and closes_at > at_instant
        ) then (
          select closes_at from dawn_bounds
          where opens_at <= at_instant and closes_at > at_instant
          order by closes_at limit 1
        )
        else (
          select min(opens_at) from dawn_bounds
          where opens_at > at_instant
        )
      end as next_transition,
      (select observed_at from rule_context where rule = 'dawn_to_dusk')
        as observed_at
    from rule_context
    where rule = 'dawn_to_dusk'
    limit 1
  ),
  schedule as materialized (
    select *
    from public.kc3_effective_regular_hours(target_place_id, at_instant)
  ),
  schedule_meta as (
    select
      exists (select 1 from schedule) as available,
      min(schedule.source_observed_at) as observed_at
    from schedule
  ),
  candidate_dates as (
    select
      place_context.time_zone,
      place_context.local_date + day_offset as schedule_date
    from place_context
    cross join generate_series(-1, 8) as offsets(day_offset)
  ),
  intervals as (
    select
      (
        candidate_dates.schedule_date + schedule.open_time
      ) at time zone candidate_dates.time_zone as opens_at,
      (
        candidate_dates.schedule_date
        + case when schedule.closes_next_day then 1 else 0 end
        + schedule.close_time
      ) at time zone candidate_dates.time_zone as closes_at
    from candidate_dates
    join schedule
      on schedule.day_of_week = extract(dow from candidate_dates.schedule_date)
    where not schedule.is_closed
  ),
  current_seed as (
    select max(intervals.closes_at) as coverage_end
    from intervals
    where intervals.opens_at <= at_instant
      and intervals.closes_at > at_instant
  ),
  coverage(coverage_end) as (
    select current_seed.coverage_end
    from current_seed
    where current_seed.coverage_end is not null
    union all
    select extension.extended_end
    from coverage
    cross join lateral (
      select max(intervals.closes_at) as extended_end
      from intervals
      where intervals.opens_at <= coverage.coverage_end
        and intervals.closes_at > coverage.coverage_end
    ) as extension
    where extension.extended_end is not null
  ),
  current_result as (
    select max(coverage.coverage_end) as coverage_end
    from coverage
  ),
  next_opening as (
    select min(intervals.opens_at) as opens_at
    from intervals
    where intervals.opens_at > at_instant
  ),
  weekly_result as (
    select
      schedule_meta.available,
      case
        when not schedule_meta.available
          or place_context.time_zone is null
          or schedule_meta.observed_at is null
          or schedule_meta.observed_at < at_instant - interval '14 days'
          then 'unknown'::public.regular_hours_state
        when current_result.coverage_end is not null
          then 'open'::public.regular_hours_state
        else 'closed'::public.regular_hours_state
      end as state,
      case
        when not schedule_meta.available
          or place_context.time_zone is null
          or schedule_meta.observed_at is null
          or schedule_meta.observed_at < at_instant - interval '14 days'
          then null
        when current_result.coverage_end >= at_instant + interval '7 days'
          then null
        when current_result.coverage_end is not null
          then current_result.coverage_end
        else next_opening.opens_at
      end as next_transition,
      schedule_meta.observed_at
    from schedule_meta
    left join place_context on true
    left join current_result on true
    left join next_opening on true
  )
  select dawn_result.available, dawn_result.state,
    dawn_result.next_transition, dawn_result.observed_at
  from dawn_result
  union all
  select weekly_result.available, weekly_result.state,
    weekly_result.next_transition, weekly_result.observed_at
  from weekly_result
  where not exists (
    select 1 from rule_context where rule = 'dawn_to_dusk'
  );
$$;

revoke all on function public.kc3_regular_hours_status(uuid, timestamptz)
from public, anon, authenticated, service_role;
grant execute on function public.kc3_regular_hours_status(uuid, timestamptz)
to kc3_public_place_reader;

drop function public.list_public_place_summaries();

create function public.list_public_place_summaries()
returns table (
  id uuid,
  name text,
  city text,
  address text,
  address_precision public.address_precision,
  place_type public.place_type,
  regular_hours_available boolean,
  regular_hours_rule text,
  regular_hours_state public.regular_hours_state,
  regular_hours_next_transition_at timestamptz,
  regular_hours_observed_at timestamptz,
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
    coalesce(publication.hours_evidence ->> 'ruleType', 'weekly'),
    hours_status.hours_state,
    hours_status.next_transition_at,
    hours_status.hours_observed_at,
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
  join public.place_publications as publication
    on publication.place_id = places.id
  left join public.place_details as details on details.place_id = places.id
  cross join lateral public.kc3_regular_hours_status(places.id, now())
    as hours_status
  where places.status = 'active'
  order by places.name, places.id;
$$;

revoke all on function public.list_public_place_summaries()
from public, anon, authenticated, service_role;
grant execute on function public.list_public_place_summaries() to anon;
grant kc3_public_place_reader to postgres;
grant create on schema public to kc3_public_place_reader;
alter function public.list_public_place_summaries()
  owner to kc3_public_place_reader;

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
  regular_hours_rule text,
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
    coalesce(publication.hours_evidence ->> 'ruleType', 'weekly'),
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
  join public.place_publications as publication
    on publication.place_id = places.id
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
grant kc3_public_place_reader to postgres;
grant create on schema public to kc3_public_place_reader;
alter function public.get_public_place_detail(uuid)
  owner to kc3_public_place_reader;

revoke create on schema public from kc3_public_place_reader;
revoke kc3_public_place_reader from postgres;
