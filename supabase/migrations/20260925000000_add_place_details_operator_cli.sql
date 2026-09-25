-- KC3-35 exposes an attended, server-only boundary for KC3-owned
-- detail editing. The function owner has no write privilege on provider-owned
-- identity, metadata, hours, lifecycle, or override data.

create role kc3_place_detail_operator
  nologin
  noinherit
  nosuperuser
  nocreatedb
  nocreaterole
  noreplication
  nobypassrls;

-- Project migrations run as the managed postgres role rather than a cluster
-- superuser. Membership is needed only while assigning function ownership.
grant kc3_place_detail_operator to postgres;
grant create on schema public to kc3_place_detail_operator;

grant usage on schema public to kc3_place_detail_operator;
grant usage on type
  public.place_type,
  public.place_status,
  public.outlet_level,
  public.wifi_type,
  public.work_suitability,
  public.food_beverage_level
to kc3_place_detail_operator;

grant select (id, name, city, address, place_type, google_place_id, status)
on public.places to kc3_place_detail_operator;
grant select (
  place_id, google_name, google_address, google_business_status,
  google_fetched_at
)
on public.place_google_data to kc3_place_detail_operator;
grant select (
  place_id, seating_notes, outlets, wifi, work_suitability, food_beverage,
  phone_calls_allowed, bathroom_available, drive_thru_available,
  drive_thru_only, last_verified_at, verification_notes, updated_at
)
on public.place_details to kc3_place_detail_operator;
grant insert (
  place_id, seating_notes, outlets, wifi, work_suitability, food_beverage,
  phone_calls_allowed, bathroom_available, drive_thru_available,
  drive_thru_only, last_verified_at, verification_notes
)
on public.place_details to kc3_place_detail_operator;
grant update (
  seating_notes, outlets, wifi, work_suitability, food_beverage,
  phone_calls_allowed, bathroom_available, drive_thru_available,
  drive_thru_only, last_verified_at, verification_notes
)
on public.place_details to kc3_place_detail_operator;

create policy place_detail_operator_reads_active_provider_places
on public.places
for select
to kc3_place_detail_operator
using (status = 'active' and google_place_id is not null);

create policy place_detail_operator_reads_provider_identity
on public.place_google_data
for select
to kc3_place_detail_operator
using (
  exists (
    select 1
    from public.places
    where places.id = place_google_data.place_id
      and places.status = 'active'
      and places.google_place_id is not null
  )
);

create policy place_detail_operator_reads_details
on public.place_details
for select
to kc3_place_detail_operator
using (
  exists (
    select 1
    from public.places
    where places.id = place_details.place_id
      and places.status = 'active'
      and places.google_place_id is not null
  )
);

create policy place_detail_operator_inserts_details
on public.place_details
for insert
to kc3_place_detail_operator
with check (
  exists (
    select 1
    from public.places
    where places.id = place_details.place_id
      and places.status = 'active'
      and places.google_place_id is not null
  )
);

create policy place_detail_operator_updates_details
on public.place_details
for update
to kc3_place_detail_operator
using (
  exists (
    select 1
    from public.places
    where places.id = place_details.place_id
      and places.status = 'active'
      and places.google_place_id is not null
  )
)
with check (
  exists (
    select 1
    from public.places
    where places.id = place_details.place_id
      and places.status = 'active'
      and places.google_place_id is not null
  )
);

create function public.kc3_operator_place_json(target_place_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', places.id::text,
    'name', places.name,
    'city', places.city,
    'address', places.address,
    'placeType', places.place_type,
    'googlePlaceId', places.google_place_id,
    'googleName', google.google_name,
    'googleAddress', google.google_address,
    'googleBusinessStatus', google.google_business_status,
    'googleFetchedAt', google.google_fetched_at,
    'detailUpdatedAt', details.updated_at,
    'details', jsonb_build_object(
      'seatingNotes', details.seating_notes,
      'outlets', coalesce(details.outlets, 'unknown'::public.outlet_level),
      'wifi', coalesce(details.wifi, 'unknown'::public.wifi_type),
      'workSuitability', coalesce(
        details.work_suitability,
        'unknown'::public.work_suitability
      ),
      'foodBeverage', coalesce(
        details.food_beverage,
        'unknown'::public.food_beverage_level
      ),
      'phoneCallsAllowed', details.phone_calls_allowed,
      'bathroomAvailable', details.bathroom_available,
      'driveThruAvailable', details.drive_thru_available,
      'driveThruOnly', details.drive_thru_only,
      'lastVerifiedAt', details.last_verified_at,
      'verificationNotes', details.verification_notes
    )
  )
  from public.places as places
  join public.place_google_data as google on google.place_id = places.id
  left join public.place_details as details on details.place_id = places.id
  where places.id = target_place_id
    and places.status = 'active'
    and places.google_place_id is not null;
$$;

revoke execute on function public.kc3_operator_place_json(uuid)
from public, anon, authenticated, service_role;
alter function public.kc3_operator_place_json(uuid)
owner to kc3_place_detail_operator;

create function public.kc3_search_places_for_details(
  name_query text,
  city_query text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      public.kc3_operator_place_json(places.id)
      order by lower(places.name), lower(places.address), places.id
    ),
    '[]'::jsonb
  )
  from public.places as places
  where places.status = 'active'
    and places.google_place_id is not null
    and btrim(name_query) <> ''
    and btrim(city_query) <> ''
    and places.name ilike '%' || btrim(name_query) || '%'
    and lower(places.city) = lower(btrim(city_query));
$$;

comment on function public.kc3_search_places_for_details(text, text) is
  'Server-only active/provider-backed identity search for the attended KC3 detail editor.';

revoke execute on function public.kc3_search_places_for_details(text, text)
from public, anon, authenticated;
alter function public.kc3_search_places_for_details(text, text)
owner to kc3_place_detail_operator;
grant execute on function public.kc3_search_places_for_details(text, text)
to service_role;

create function public.kc3_upsert_place_details(
  target_place_id uuid,
  payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  supplied_details jsonb;
  expected_updated_at text;
  current_updated_at timestamptz;
begin
  if payload is null or jsonb_typeof(payload) <> 'object'
    or payload - array['expectedUpdatedAt', 'details'] <> '{}'::jsonb
    or not payload ? 'expectedUpdatedAt'
    or jsonb_typeof(payload -> 'details') <> 'object'
  then
    raise exception using errcode = '22023', message = 'detail payload has unsupported or missing fields';
  end if;

  supplied_details := payload -> 'details';
  if supplied_details - array[
    'seatingNotes', 'outlets', 'wifi', 'workSuitability', 'foodBeverage',
    'phoneCallsAllowed', 'bathroomAvailable', 'driveThruAvailable',
    'driveThruOnly', 'lastVerifiedAt', 'verificationNotes'
  ] <> '{}'::jsonb
    or not supplied_details ?& array[
      'seatingNotes', 'outlets', 'wifi', 'workSuitability', 'foodBeverage',
      'phoneCallsAllowed', 'bathroomAvailable', 'driveThruAvailable',
      'driveThruOnly', 'lastVerifiedAt', 'verificationNotes'
    ]
  then
    raise exception using errcode = '22023', message = 'detail values have unsupported or missing fields';
  end if;

  if jsonb_typeof(supplied_details -> 'outlets') <> 'string'
    or supplied_details ->> 'outlets' not in ('none', 'few', 'many', 'unknown')
    or jsonb_typeof(supplied_details -> 'wifi') <> 'string'
    or supplied_details ->> 'wifi' not in (
      'public', 'password_printed', 'password_on_request', 'none', 'unknown'
    )
    or jsonb_typeof(supplied_details -> 'workSuitability') <> 'string'
    or supplied_details ->> 'workSuitability' not in ('good', 'okay', 'poor', 'unknown')
    or jsonb_typeof(supplied_details -> 'foodBeverage') <> 'string'
    or supplied_details ->> 'foodBeverage' not in ('none', 'light', 'full', 'unknown')
  then
    raise exception using errcode = '22023', message = 'detail classification is invalid';
  end if;

  if exists (
    select 1
    from jsonb_each(supplied_details) as detail(key, value)
    where detail.key in (
      'phoneCallsAllowed', 'bathroomAvailable',
      'driveThruAvailable', 'driveThruOnly'
    )
      and jsonb_typeof(detail.value) not in ('boolean', 'null')
  ) then
    raise exception using errcode = '22023', message = 'nullable detail fact is invalid';
  end if;

  if exists (
    select 1
    from jsonb_each(supplied_details) as detail(key, value)
    where detail.key in ('seatingNotes', 'verificationNotes', 'lastVerifiedAt')
      and jsonb_typeof(detail.value) not in ('string', 'null')
  )
    or exists (
      select 1
      from jsonb_each(supplied_details) as detail(key, value)
      where detail.key in ('seatingNotes', 'verificationNotes')
        and jsonb_typeof(detail.value) = 'string'
        and btrim(detail.value #>> '{}') = ''
    )
  then
    raise exception using errcode = '22023', message = 'nullable detail text is invalid';
  end if;

  if supplied_details -> 'driveThruOnly' = 'true'::jsonb
    and supplied_details -> 'driveThruAvailable' <> 'true'::jsonb
  then
    raise exception using errcode = '23514', message = 'drive-thru-only requires drive-thru availability';
  end if;

  if jsonb_typeof(payload -> 'expectedUpdatedAt') not in ('string', 'null') then
    raise exception using errcode = '22023', message = 'expected detail version is invalid';
  end if;
  expected_updated_at := payload ->> 'expectedUpdatedAt';

  -- Serialize attended edits for this KC3 identity before checking the active,
  -- provider-backed boundary and locking any existing detail row.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_place_id::text, 12633426)
  );
  perform 1
  from public.places
  where id = target_place_id
    and status = 'active'
    and google_place_id is not null;
  if not found then
    raise exception using errcode = 'P0002', message = 'active provider-backed place not found';
  end if;

  select updated_at
  into current_updated_at
  from public.place_details
  where place_id = target_place_id
  for update;

  if current_updated_at::text is distinct from expected_updated_at then
    raise exception using errcode = '40001', message = 'place details changed after selection';
  end if;

  insert into public.place_details (
    place_id, seating_notes, outlets, wifi, work_suitability, food_beverage,
    phone_calls_allowed, bathroom_available, drive_thru_available,
    drive_thru_only, last_verified_at, verification_notes
  ) values (
    target_place_id,
    case when supplied_details -> 'seatingNotes' = 'null'::jsonb then null else supplied_details ->> 'seatingNotes' end,
    (supplied_details ->> 'outlets')::public.outlet_level,
    (supplied_details ->> 'wifi')::public.wifi_type,
    (supplied_details ->> 'workSuitability')::public.work_suitability,
    (supplied_details ->> 'foodBeverage')::public.food_beverage_level,
    (supplied_details ->> 'phoneCallsAllowed')::boolean,
    (supplied_details ->> 'bathroomAvailable')::boolean,
    (supplied_details ->> 'driveThruAvailable')::boolean,
    (supplied_details ->> 'driveThruOnly')::boolean,
    (supplied_details ->> 'lastVerifiedAt')::date,
    case when supplied_details -> 'verificationNotes' = 'null'::jsonb then null else supplied_details ->> 'verificationNotes' end
  )
  on conflict (place_id) do update set
    seating_notes = excluded.seating_notes,
    outlets = excluded.outlets,
    wifi = excluded.wifi,
    work_suitability = excluded.work_suitability,
    food_beverage = excluded.food_beverage,
    phone_calls_allowed = excluded.phone_calls_allowed,
    bathroom_available = excluded.bathroom_available,
    drive_thru_available = excluded.drive_thru_available,
    drive_thru_only = excluded.drive_thru_only,
    last_verified_at = excluded.last_verified_at,
    verification_notes = excluded.verification_notes;

  return public.kc3_operator_place_json(target_place_id);
end;
$$;

comment on function public.kc3_upsert_place_details(uuid, jsonb) is
  'Server-only atomic upsert limited to the approved KC3-owned detail contract.';

revoke execute on function public.kc3_upsert_place_details(uuid, jsonb)
from public, anon, authenticated;
alter function public.kc3_upsert_place_details(uuid, jsonb)
owner to kc3_place_detail_operator;
grant execute on function public.kc3_upsert_place_details(uuid, jsonb)
to service_role;

revoke create on schema public from kc3_place_detail_operator;
revoke kc3_place_detail_operator from postgres;
