-- KC3-25 exposes a server-only ingestion boundary. The Expo client receives no
-- grants, credentials, table access, or generated database types from this API.

create role kc3_google_importer
  nologin
  noinherit
  nosuperuser
  nocreatedb
  nocreaterole
  noreplication
  nobypassrls;

grant usage on schema public to kc3_google_importer;
grant usage on type
  public.place_type,
  public.place_status,
  public.hours_source
to kc3_google_importer;

grant select, insert, update on public.places to kc3_google_importer;
grant select, insert, update on public.place_google_data to kc3_google_importer;
grant select, insert, delete on public.place_hours to kc3_google_importer;

create policy google_importer_accesses_places
on public.places
for all
to kc3_google_importer
using (true)
with check (true);

create policy google_importer_accesses_google_data
on public.place_google_data
for all
to kc3_google_importer
using (true)
with check (true);

create policy google_importer_accesses_hours
on public.place_hours
for all
to kc3_google_importer
using (true)
with check (true);

create function public.kc3_google_import_state()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', places.id::text,
        'name', places.name,
        'city', places.city,
        'address', places.address,
        'placeType', places.place_type,
        'googlePlaceId', places.google_place_id,
        'latitude', places.latitude,
        'longitude', places.longitude,
        'timeZone', places.time_zone,
        'status', places.status,
        'googleBusinessStatus', google.google_business_status,
        'googleHours', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'dayOfWeek', hours.day_of_week,
                'openTime', case when hours.open_time is null then null else to_char(hours.open_time, 'HH24:MI') end,
                'closeTime', case when hours.close_time is null then null else to_char(hours.close_time, 'HH24:MI') end,
                'isClosed', hours.is_closed,
                'closesNextDay', hours.closes_next_day
              )
              order by hours.day_of_week, hours.open_time nulls last
            )
            from public.place_hours as hours
            where hours.place_id = places.id and hours.source = 'google'
          ),
          '[]'::jsonb
        )
      )
      order by places.id
    ),
    '[]'::jsonb
  )
  from public.places as places
  left join public.place_google_data as google
    on google.place_id = places.id;
$$;

comment on function public.kc3_google_import_state() is
  'Server-only minimal state used to plan Google identity matches, duplicate review, and source-preserving refreshes.';

create function public.kc3_import_google_place(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  provider jsonb;
  canonical jsonb;
  target_place_id uuid;
  expected_place_id uuid;
  fetched_at timestamptz;
  import_action text;
  hour_row jsonb;
begin
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception using errcode = '22023', message = 'import payload must be an object';
  end if;

  if payload - array[
    'googlePlaceId', 'expectedPlaceId', 'placeType', 'fetchedAt',
    'provider', 'canonical', 'hours'
  ] <> '{}'::jsonb then
    raise exception using errcode = '22023', message = 'import payload contains unsupported fields';
  end if;

  if jsonb_typeof(payload -> 'googlePlaceId') <> 'string'
    or btrim(payload ->> 'googlePlaceId') = ''
    or jsonb_typeof(payload -> 'placeType') <> 'string'
    or jsonb_typeof(payload -> 'fetchedAt') <> 'string'
    or jsonb_typeof(payload -> 'provider') <> 'object'
    or jsonb_typeof(payload -> 'canonical') <> 'object'
  then
    raise exception using errcode = '22023', message = 'import payload is missing required normalized fields';
  end if;

  provider := payload -> 'provider';
  canonical := payload -> 'canonical';
  fetched_at := (payload ->> 'fetchedAt')::timestamptz;

  if provider - array[
    'name', 'address', 'addressComponents', 'latitude', 'longitude',
    'businessStatus', 'primaryType', 'types', 'timeZone', 'movedPlaceId',
    'mapsUri', 'rating', 'userRatingCount', 'websiteUri', 'priceLevel'
  ] <> '{}'::jsonb
    or canonical - array[
      'name', 'city', 'address', 'latitude', 'longitude', 'timeZone', 'status'
    ] <> '{}'::jsonb
  then
    raise exception using errcode = '22023', message = 'normalized fields contain unsupported values';
  end if;

  if (provider ? 'latitude') <> (provider ? 'longitude')
    or (canonical ? 'latitude') <> (canonical ? 'longitude')
  then
    raise exception using errcode = '22023', message = 'coordinates must be complete pairs';
  end if;

  if provider ? 'addressComponents'
    and (
      jsonb_typeof(provider -> 'addressComponents') <> 'array'
      or jsonb_array_length(provider -> 'addressComponents') = 0
    )
  then
    raise exception using errcode = '22023', message = 'address components must be a nonempty array';
  end if;

  if provider ? 'types' and (
      jsonb_typeof(provider -> 'types') <> 'array'
      or jsonb_array_length(provider -> 'types') = 0
      or exists (
        select 1
        from jsonb_array_elements(provider -> 'types') as provider_type(value)
        where jsonb_typeof(provider_type.value) <> 'string'
          or btrim(provider_type.value #>> '{}') = ''
      )
    )
  then
    raise exception using errcode = '22023', message = 'types must be a nonempty string array';
  end if;

  if (provider ? 'latitude' and (
      jsonb_typeof(provider -> 'latitude') <> 'number'
      or jsonb_typeof(provider -> 'longitude') <> 'number'
      or (provider ->> 'latitude')::double precision not between -90 and 90
      or (provider ->> 'longitude')::double precision not between -180 and 180
    ))
    or (canonical ? 'latitude' and (
      jsonb_typeof(canonical -> 'latitude') <> 'number'
      or jsonb_typeof(canonical -> 'longitude') <> 'number'
      or (canonical ->> 'latitude')::double precision not between -90 and 90
      or (canonical ->> 'longitude')::double precision not between -180 and 180
    ))
  then
    raise exception using errcode = '22023', message = 'coordinates are invalid';
  end if;

  if provider ? 'businessStatus'
    and provider ->> 'businessStatus' not in (
      'BUSINESS_STATUS_UNSPECIFIED', 'OPERATIONAL', 'CLOSED_TEMPORARILY',
      'CLOSED_PERMANENTLY', 'FUTURE_OPENING'
    )
  then
    raise exception using errcode = '22023', message = 'invalid provider business status';
  end if;

  if provider ? 'priceLevel'
    and provider ->> 'priceLevel' not in (
      'PRICE_LEVEL_UNSPECIFIED', 'PRICE_LEVEL_FREE', 'PRICE_LEVEL_INEXPENSIVE',
      'PRICE_LEVEL_MODERATE', 'PRICE_LEVEL_EXPENSIVE',
      'PRICE_LEVEL_VERY_EXPENSIVE'
    )
  then
    raise exception using errcode = '22023', message = 'invalid provider price level';
  end if;

  if payload ? 'expectedPlaceId' and payload -> 'expectedPlaceId' <> 'null'::jsonb then
    expected_place_id := (payload ->> 'expectedPlaceId')::uuid;
  end if;

  -- Serialize imports for one provider identity. This makes a concurrent first
  -- import re-read the winner instead of creating a second canonical place.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(payload ->> 'googlePlaceId', 12633425)
  );

  select places.id
  into target_place_id
  from public.places as places
  where places.google_place_id = payload ->> 'googlePlaceId'
  for update;

  if expected_place_id is not null and target_place_id is distinct from expected_place_id then
    raise exception using errcode = '40001', message = 'provider identity changed during import planning';
  end if;

  if target_place_id is null then
    if not (
      canonical ? 'name' and canonical ? 'city' and canonical ? 'address'
      and canonical ? 'latitude' and canonical ? 'longitude'
      and canonical ? 'timeZone'
    ) then
      raise exception using errcode = '22023', message = 'new place is missing required canonical fields';
    end if;

    if btrim(canonical ->> 'name') = ''
      or btrim(canonical ->> 'city') = ''
      or btrim(canonical ->> 'address') = ''
      or btrim(canonical ->> 'timeZone') = ''
    then
      raise exception using errcode = '22023', message = 'new canonical text fields cannot be blank';
    end if;

    insert into public.places (
      name, city, address, place_type, google_place_id, status,
      latitude, longitude, time_zone
    ) values (
      canonical ->> 'name',
      canonical ->> 'city',
      canonical ->> 'address',
      (payload ->> 'placeType')::public.place_type,
      payload ->> 'googlePlaceId',
      coalesce((canonical ->> 'status')::public.place_status, 'active'),
      (canonical ->> 'latitude')::double precision,
      (canonical ->> 'longitude')::double precision,
      canonical ->> 'timeZone'
    )
    returning id into target_place_id;
    import_action := 'inserted';
  else
    if canonical <> '{}'::jsonb then
      update public.places as places
      set
        name = case when canonical ? 'name' then canonical ->> 'name' else places.name end,
        city = case when canonical ? 'city' then canonical ->> 'city' else places.city end,
        address = case when canonical ? 'address' then canonical ->> 'address' else places.address end,
        latitude = case when canonical ? 'latitude' then (canonical ->> 'latitude')::double precision else places.latitude end,
        longitude = case when canonical ? 'longitude' then (canonical ->> 'longitude')::double precision else places.longitude end,
        time_zone = case when canonical ? 'timeZone' then canonical ->> 'timeZone' else places.time_zone end,
        status = case when canonical ? 'status' then (canonical ->> 'status')::public.place_status else places.status end
      where places.id = target_place_id;
    end if;
    import_action := 'updated';
  end if;

  insert into public.place_google_data as stored (
    place_id, google_name, google_address, google_address_components,
    google_latitude, google_longitude, google_business_status,
    google_primary_type, google_types, google_time_zone,
    google_moved_place_id, google_maps_uri, google_rating,
    google_user_rating_count, google_website_uri, google_price_level,
    google_fetched_at
  ) values (
    target_place_id,
    provider ->> 'name',
    provider ->> 'address',
    provider -> 'addressComponents',
    (provider ->> 'latitude')::double precision,
    (provider ->> 'longitude')::double precision,
    provider ->> 'businessStatus',
    provider ->> 'primaryType',
    case when provider ? 'types'
      then array(select jsonb_array_elements_text(provider -> 'types'))
      else null
    end,
    provider ->> 'timeZone',
    provider ->> 'movedPlaceId',
    provider ->> 'mapsUri',
    (provider ->> 'rating')::numeric,
    (provider ->> 'userRatingCount')::integer,
    provider ->> 'websiteUri',
    provider ->> 'priceLevel',
    fetched_at
  )
  on conflict (place_id) do update
  set
    google_name = case when provider ? 'name' then excluded.google_name else stored.google_name end,
    google_address = case when provider ? 'address' then excluded.google_address else stored.google_address end,
    google_address_components = case when provider ? 'addressComponents' then excluded.google_address_components else stored.google_address_components end,
    google_latitude = case when provider ? 'latitude' then excluded.google_latitude else stored.google_latitude end,
    google_longitude = case when provider ? 'longitude' then excluded.google_longitude else stored.google_longitude end,
    google_business_status = case when provider ? 'businessStatus' then excluded.google_business_status else stored.google_business_status end,
    google_primary_type = case when provider ? 'primaryType' then excluded.google_primary_type else stored.google_primary_type end,
    google_types = case when provider ? 'types' then excluded.google_types else stored.google_types end,
    google_time_zone = case when provider ? 'timeZone' then excluded.google_time_zone else stored.google_time_zone end,
    google_moved_place_id = case when provider ? 'movedPlaceId' then excluded.google_moved_place_id else stored.google_moved_place_id end,
    google_maps_uri = case when provider ? 'mapsUri' then excluded.google_maps_uri else stored.google_maps_uri end,
    google_rating = case when provider ? 'rating' then excluded.google_rating else stored.google_rating end,
    google_user_rating_count = case when provider ? 'userRatingCount' then excluded.google_user_rating_count else stored.google_user_rating_count end,
    google_website_uri = case when provider ? 'websiteUri' then excluded.google_website_uri else stored.google_website_uri end,
    google_price_level = case when provider ? 'priceLevel' then excluded.google_price_level else stored.google_price_level end,
    google_fetched_at = excluded.google_fetched_at;

  if payload ? 'hours' then
    if jsonb_typeof(payload -> 'hours') <> 'array'
      or jsonb_array_length(payload -> 'hours') = 0
      or jsonb_array_length(payload -> 'hours') > 100
    then
      raise exception using errcode = '22023', message = 'hours replacement must be a bounded nonempty array';
    end if;

    for hour_row in select value from jsonb_array_elements(payload -> 'hours')
    loop
      if jsonb_typeof(hour_row) <> 'object'
        or hour_row - array[
          'dayOfWeek', 'openTime', 'closeTime', 'isClosed', 'closesNextDay'
        ] <> '{}'::jsonb
        or not (
          hour_row ? 'dayOfWeek' and hour_row ? 'openTime'
          and hour_row ? 'closeTime' and hour_row ? 'isClosed'
          and hour_row ? 'closesNextDay'
        )
        or jsonb_typeof(hour_row -> 'dayOfWeek') <> 'number'
        or (hour_row ->> 'dayOfWeek')::numeric % 1 <> 0
        or (hour_row ->> 'dayOfWeek')::integer not between 0 and 6
        or jsonb_typeof(hour_row -> 'isClosed') <> 'boolean'
        or jsonb_typeof(hour_row -> 'closesNextDay') <> 'boolean'
        or jsonb_typeof(hour_row -> 'openTime') not in ('string', 'null')
        or jsonb_typeof(hour_row -> 'closeTime') not in ('string', 'null')
      then
        raise exception using errcode = '22023', message = 'hours replacement contains an invalid row';
      end if;
    end loop;

    delete from public.place_hours as hours
    where hours.place_id = target_place_id and hours.source = 'google';

    insert into public.place_hours (
      place_id, day_of_week, open_time, close_time, is_closed,
      closes_next_day, source, source_observed_at
    )
    select
      target_place_id,
      (row ->> 'dayOfWeek')::smallint,
      (row ->> 'openTime')::time,
      (row ->> 'closeTime')::time,
      (row ->> 'isClosed')::boolean,
      (row ->> 'closesNextDay')::boolean,
      'google'::public.hours_source,
      fetched_at
    from jsonb_array_elements(payload -> 'hours') as rows(row);
  end if;

  return jsonb_build_object(
    'placeId', target_place_id::text,
    'action', import_action
  );
end;
$$;

comment on function public.kc3_import_google_place(jsonb) is
  'Server-only atomic persistence for a validated KC3-24 normalized Google place; it cannot write KC3 details, KC3 hours, or overrides.';

revoke all on function public.kc3_google_import_state()
from public, anon, authenticated, service_role;
revoke all on function public.kc3_import_google_place(jsonb)
from public, anon, authenticated, service_role;
grant execute on function public.kc3_google_import_state() to service_role;
grant execute on function public.kc3_import_google_place(jsonb) to service_role;

-- Ownership by the constrained NOLOGIN role keeps SECURITY DEFINER narrower
-- than the migration owner. The temporary grants exist only for transfer.
grant kc3_google_importer to postgres;
grant create on schema public to kc3_google_importer;
alter function public.kc3_google_import_state() owner to kc3_google_importer;
alter function public.kc3_import_google_place(jsonb) owner to kc3_google_importer;
revoke create on schema public from kc3_google_importer;
revoke kc3_google_importer from postgres;
