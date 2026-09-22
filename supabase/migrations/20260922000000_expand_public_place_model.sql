-- KC3-30 expands the anonymous read model without granting Data API roles
-- direct access to canonical, provider, or KC3-owned tables. The original
-- five-field list_public_places() function remains available until KC3-31
-- migrates the current list atomically.

create type public.address_precision as enum (
  'street_address',
  'approximate',
  'unknown'
);

create type public.regular_hours_state as enum (
  'open',
  'closed',
  'unknown'
);

create type public.kc3_verification_state as enum (
  'unverified',
  'current',
  'stale'
);

alter table public.places
  add column address_precision public.address_precision not null default 'unknown';

comment on column public.places.address_precision is
  'KC3 canonical address precision. Clients must use this value instead of inferring precision from address punctuation.';

-- Validate accepted canonical timezones once at the write boundary. Expanding
-- pg_timezone_names inside a per-place read is expensive enough to make the
-- 164-place summary take seconds rather than milliseconds.
do $$
declare
  stored_time_zone text;
begin
  for stored_time_zone in
    select distinct places.time_zone
    from public.places as places
    where places.time_zone is not null
  loop
    begin
      perform pg_catalog.timezone(stored_time_zone, statement_timestamp());
    exception when invalid_parameter_value then
      raise exception using
        errcode = '23514',
        message = 'stored place time_zone must be a valid IANA timezone';
    end;
  end loop;
end;
$$;

create function public.kc3_validate_place_time_zone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.time_zone is not null then
    begin
      perform pg_catalog.timezone(new.time_zone, statement_timestamp());
    exception when invalid_parameter_value then
      raise exception using
        errcode = '23514',
        message = 'time_zone must be a valid IANA timezone';
    end;
  end if;

  return new;
end;
$$;

revoke all on function public.kc3_validate_place_time_zone()
from public, anon, authenticated, service_role;

create trigger validate_place_time_zone
before insert or update of time_zone on public.places
for each row
execute function public.kc3_validate_place_time_zone();

-- Existing provider-backed rows can be normalized from structured address
-- components. A later provider refresh may initialize an unknown value, but it
-- never replaces a value already accepted by KC3.
create function public.kc3_address_precision_from_components(components jsonb)
returns public.address_precision
language sql
immutable
set search_path = ''
as $$
  select case
    when components is null or jsonb_typeof(components) <> 'array'
      or jsonb_array_length(components) = 0
      then 'unknown'::public.address_precision
    when exists (
      select 1
      from jsonb_array_elements(components) as component(value)
      where jsonb_typeof(component.value -> 'types') = 'array'
        and (component.value -> 'types') ?| array[
          'street_number', 'premise', 'subpremise'
        ]
    ) then 'street_address'::public.address_precision
    else 'approximate'::public.address_precision
  end;
$$;

revoke all on function public.kc3_address_precision_from_components(jsonb)
from public, anon, authenticated, service_role;
grant execute on function public.kc3_address_precision_from_components(jsonb)
to kc3_google_importer;

update public.places as places
set address_precision = public.kc3_address_precision_from_components(
  google.google_address_components
)
from public.place_google_data as google
where google.place_id = places.id
  and places.address_precision = 'unknown'
  and public.kc3_address_precision_from_components(
    google.google_address_components
  ) <> 'unknown';

create function public.kc3_initialize_address_precision()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  normalized_precision public.address_precision;
begin
  normalized_precision := public.kc3_address_precision_from_components(
    new.google_address_components
  );

  if normalized_precision <> 'unknown' then
    update public.places as places
    set address_precision = normalized_precision
    where places.id = new.place_id
      and places.address_precision = 'unknown';
  end if;

  return new;
end;
$$;

revoke all on function public.kc3_initialize_address_precision()
from public, anon, authenticated, service_role;
grant execute on function public.kc3_initialize_address_precision()
to kc3_google_importer;

create trigger initialize_address_precision_from_google
after insert or update of google_address_components on public.place_google_data
for each row
execute function public.kc3_initialize_address_precision();

alter table public.place_details
  add column drive_thru_available boolean,
  add column drive_thru_only boolean,
  add constraint place_details_drive_thru_combination_check
    check (drive_thru_only is distinct from true or drive_thru_available is true);

comment on column public.place_details.drive_thru_available is
  'KC3-owned nullable fact: true = available, false = unavailable, null = not verified.';
comment on column public.place_details.drive_thru_only is
  'KC3-owned nullable fact independent from seating; true requires drive_thru_available = true.';

alter table public.place_overrides
  add column source_observed_at timestamptz not null default now();

comment on column public.place_overrides.source_observed_at is
  'When KC3 observed the factual value in this override; used for effective regular-hours freshness.';

alter table public.place_hours
  add constraint place_hours_interval_direction_check
    check (
      is_closed
      or closes_next_day
      or close_time > open_time
    );

-- Resolve one complete, normalized regular week. Active effective-dated KC3
-- overrides win, followed by a complete KC3 base schedule and then a complete
-- Google schedule. Invalid or partial sources fall through instead of becoming
-- fabricated open/closed claims.
create function public.kc3_effective_regular_hours(
  target_place_id uuid,
  at_instant timestamptz default now()
)
returns table (
  day_of_week smallint,
  open_time time,
  close_time time,
  is_closed boolean,
  closes_next_day boolean,
  source_observed_at timestamptz,
  effective_source text
)
language plpgsql
stable
set search_path = ''
as $$
declare
  target_time_zone text;
  override_payload jsonb;
  override_observed_at timestamptz;
  override_row jsonb;
  override_valid boolean := true;
  parsed_open_time time;
  parsed_close_time time;
begin
  select places.time_zone
  into target_time_zone
  from public.places as places
  where places.id = target_place_id;

  if target_time_zone is not null then
    select overrides.override_value, overrides.source_observed_at
    into override_payload, override_observed_at
    from public.place_overrides as overrides
    where overrides.place_id = target_place_id
      and overrides.override_type = 'regular_hours.v1'
      and overrides.effective_start_date
        <= (at_instant at time zone target_time_zone)::date
      and (
        overrides.effective_end_date is null
        or overrides.effective_end_date
          >= (at_instant at time zone target_time_zone)::date
      )
    limit 1;
  end if;

  if override_payload is not null
    and jsonb_typeof(override_payload) = 'object'
    and override_payload ->> 'version' = '1'
    and jsonb_typeof(override_payload -> 'rows') = 'array'
    and jsonb_array_length(override_payload -> 'rows') between 7 and 100
  then
    begin
      for override_row in
        select value
        from jsonb_array_elements(override_payload -> 'rows') as rows(value)
      loop
        if jsonb_typeof(override_row) <> 'object'
          or override_row - array[
            'dayOfWeek', 'openTime', 'closeTime', 'isClosed', 'closesNextDay'
          ] <> '{}'::jsonb
          or not (
            override_row ? 'dayOfWeek'
            and override_row ? 'openTime'
            and override_row ? 'closeTime'
            and override_row ? 'isClosed'
            and override_row ? 'closesNextDay'
          )
          or jsonb_typeof(override_row -> 'dayOfWeek') <> 'number'
          or (override_row ->> 'dayOfWeek') !~ '^[0-6]$'
          or jsonb_typeof(override_row -> 'isClosed') <> 'boolean'
          or jsonb_typeof(override_row -> 'closesNextDay') <> 'boolean'
        then
          override_valid := false;
          exit;
        end if;

        if (override_row ->> 'isClosed')::boolean then
          if override_row -> 'openTime' <> 'null'::jsonb
            or override_row -> 'closeTime' <> 'null'::jsonb
            or (override_row ->> 'closesNextDay')::boolean
          then
            override_valid := false;
            exit;
          end if;
        else
          if jsonb_typeof(override_row -> 'openTime') <> 'string'
            or jsonb_typeof(override_row -> 'closeTime') <> 'string'
          then
            override_valid := false;
            exit;
          end if;

          parsed_open_time := (override_row ->> 'openTime')::time;
          parsed_close_time := (override_row ->> 'closeTime')::time;
          if not (override_row ->> 'closesNextDay')::boolean
            and parsed_close_time <= parsed_open_time
          then
            override_valid := false;
            exit;
          end if;
        end if;
      end loop;
    exception when others then
      override_valid := false;
    end;

    if override_valid
      and (
        select count(distinct (row ->> 'dayOfWeek')::integer) = 7
        from jsonb_array_elements(override_payload -> 'rows') as rows(row)
      )
      and not exists (
        select 1
        from jsonb_array_elements(override_payload -> 'rows') as rows(row)
        group by (row ->> 'dayOfWeek')::integer
        having bool_or((row ->> 'isClosed')::boolean) and count(*) > 1
      )
    then
      return query
      select
        (row ->> 'dayOfWeek')::smallint,
        (row ->> 'openTime')::time,
        (row ->> 'closeTime')::time,
        (row ->> 'isClosed')::boolean,
        (row ->> 'closesNextDay')::boolean,
        override_observed_at,
        'override'::text
      from jsonb_array_elements(override_payload -> 'rows') as rows(row)
      order by
        (row ->> 'dayOfWeek')::smallint,
        (row ->> 'openTime')::time nulls last;
      return;
    end if;
  end if;

  if exists (
    select 1
    from public.place_hours as hours
    where hours.place_id = target_place_id
      and hours.source = 'kc3'
    having count(distinct hours.day_of_week) = 7
      and count(hours.source_observed_at) = count(*)
      and not exists (
        select 1
        from public.place_hours as daily_hours
        where daily_hours.place_id = target_place_id
          and daily_hours.source = 'kc3'
        group by daily_hours.day_of_week
        having bool_or(daily_hours.is_closed) and count(*) > 1
      )
  ) then
    return query
    select
      hours.day_of_week,
      hours.open_time,
      hours.close_time,
      hours.is_closed,
      hours.closes_next_day,
      min(hours.source_observed_at) over (),
      'kc3'::text
    from public.place_hours as hours
    where hours.place_id = target_place_id
      and hours.source = 'kc3'
    order by hours.day_of_week, hours.open_time nulls last;
    return;
  end if;

  if exists (
    select 1
    from public.place_hours as hours
    where hours.place_id = target_place_id
      and hours.source = 'google'
    having count(distinct hours.day_of_week) = 7
      and count(hours.source_observed_at) = count(*)
      and not exists (
        select 1
        from public.place_hours as daily_hours
        where daily_hours.place_id = target_place_id
          and daily_hours.source = 'google'
        group by daily_hours.day_of_week
        having bool_or(daily_hours.is_closed) and count(*) > 1
      )
  ) then
    return query
    select
      hours.day_of_week,
      hours.open_time,
      hours.close_time,
      hours.is_closed,
      hours.closes_next_day,
      min(hours.source_observed_at) over (),
      'google'::text
    from public.place_hours as hours
    where hours.place_id = target_place_id
      and hours.source = 'google'
    order by hours.day_of_week, hours.open_time nulls last;
  end if;
end;
$$;

revoke all on function public.kc3_effective_regular_hours(uuid, timestamptz)
from public, anon, authenticated, service_role;
grant execute on function public.kc3_effective_regular_hours(uuid, timestamptz)
to kc3_public_place_reader;

create function public.kc3_regular_hours_status(
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
set search_path = ''
as $$
  with recursive
  place_context as (
    select
      places.time_zone,
      (at_instant at time zone places.time_zone)::date as local_date
    from public.places as places
    where places.id = target_place_id
      and places.time_zone is not null
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
  )
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
    end,
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
    end,
    schedule_meta.observed_at
  from schedule_meta
  left join place_context on true
  left join current_result on true
  left join next_opening on true;
$$;

revoke all on function public.kc3_regular_hours_status(uuid, timestamptz)
from public, anon, authenticated, service_role;
grant execute on function public.kc3_regular_hours_status(uuid, timestamptz)
to kc3_public_place_reader;

grant usage on type
  public.address_precision,
  public.kc3_verification_state,
  public.regular_hours_state,
  public.outlet_level,
  public.wifi_type,
  public.work_suitability,
  public.food_beverage_level,
  public.hours_source
to kc3_public_place_reader;

grant select (
  address_precision, time_zone
) on public.places to kc3_public_place_reader;

grant select (
  place_id, seating_notes, outlets, wifi, work_suitability, food_beverage,
  phone_calls_allowed, bathroom_available, drive_thru_available,
  drive_thru_only, last_verified_at
) on public.place_details to kc3_public_place_reader;

grant select (
  place_id, day_of_week, open_time, close_time, is_closed, closes_next_day,
  source, source_observed_at
) on public.place_hours to kc3_public_place_reader;

grant select (
  place_id, override_type, effective_start_date, effective_end_date,
  override_value, source_observed_at
) on public.place_overrides to kc3_public_place_reader;

create policy public_place_reader_selects_active_details
on public.place_details
for select
to kc3_public_place_reader
using (
  exists (
    select 1
    from public.places
    where places.id = place_details.place_id
      and places.status = 'active'
  )
);

create policy public_place_reader_selects_active_hours
on public.place_hours
for select
to kc3_public_place_reader
using (
  exists (
    select 1
    from public.places
    where places.id = place_hours.place_id
      and places.status = 'active'
  )
);

create policy public_place_reader_selects_active_overrides
on public.place_overrides
for select
to kc3_public_place_reader
using (
  exists (
    select 1
    from public.places
    where places.id = place_overrides.place_id
      and places.status = 'active'
  )
);

create function public.list_public_place_summaries()
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
  where places.status = 'active'
  order by places.name, places.id;
$$;

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

revoke all on function public.list_public_place_summaries()
from public, anon, authenticated, service_role;
revoke all on function public.get_public_place_detail(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.list_public_place_summaries() to anon;
grant execute on function public.get_public_place_detail(uuid) to anon;

comment on function public.list_public_place_summaries() is
  'Returns the bounded KC3-30 anonymous summary projection for active places.';
comment on function public.get_public_place_detail(uuid) is
  'Returns one bounded KC3-30 anonymous detail projection for an active place ID.';

grant kc3_public_place_reader to postgres;
grant create on schema public to kc3_public_place_reader;
alter function public.list_public_place_summaries()
  owner to kc3_public_place_reader;
alter function public.get_public_place_detail(uuid)
  owner to kc3_public_place_reader;
revoke create on schema public from kc3_public_place_reader;
revoke kc3_public_place_reader from postgres;
