-- Provide a narrow, attended boundary for correcting canonical place facts.
-- Every successful correction records its evidence and exact before/after
-- values in an immutable audit row.

create table public.place_canonical_corrections (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  before_values jsonb not null,
  after_values jsonb not null,
  source_url text not null,
  source_observed_on date not null,
  correction_notes text not null,
  created_at timestamptz not null default now(),
  constraint place_canonical_corrections_source_url_check
    check (source_url ~ '^https://[^[:space:]]+$'),
  constraint place_canonical_corrections_notes_check
    check (btrim(correction_notes) <> ''),
  constraint place_canonical_corrections_changed_check
    check (before_values <> after_values)
);

create index place_canonical_corrections_place_created_idx
  on public.place_canonical_corrections (place_id, created_at desc);

alter table public.place_canonical_corrections enable row level security;

revoke all on table public.place_canonical_corrections
from public, anon, authenticated, service_role;

create role kc3_canonical_correction_operator
  nologin
  noinherit
  nosuperuser
  nocreatedb
  nocreaterole
  noreplication
  nobypassrls;

grant kc3_canonical_correction_operator to postgres;
grant create on schema public to kc3_canonical_correction_operator;
grant usage on schema public to kc3_canonical_correction_operator;
grant usage on type
  public.place_type,
  public.place_status,
  public.address_precision
to kc3_canonical_correction_operator;

grant select (
  id, name, city, address, address_precision, place_type, google_place_id,
  status, updated_at
)
on public.places to kc3_canonical_correction_operator;
grant update (name, address, address_precision, place_type)
on public.places to kc3_canonical_correction_operator;
grant select (
  place_id, google_name, google_address, google_primary_type, google_types,
  google_business_status, google_fetched_at
)
on public.place_google_data to kc3_canonical_correction_operator;
grant insert (
  place_id, before_values, after_values, source_url, source_observed_on,
  correction_notes
)
on public.place_canonical_corrections to kc3_canonical_correction_operator;

create policy canonical_correction_operator_reads_active_provider_places
on public.places
for select
to kc3_canonical_correction_operator
using (status = 'active' and google_place_id is not null);

create policy canonical_correction_operator_updates_active_provider_places
on public.places
for update
to kc3_canonical_correction_operator
using (status = 'active' and google_place_id is not null)
with check (status = 'active' and google_place_id is not null);

create policy canonical_correction_operator_reads_provider_context
on public.place_google_data
for select
to kc3_canonical_correction_operator
using (
  exists (
    select 1
    from public.places
    where places.id = place_google_data.place_id
      and places.status = 'active'
      and places.google_place_id is not null
  )
);

create policy canonical_correction_operator_inserts_audit_rows
on public.place_canonical_corrections
for insert
to kc3_canonical_correction_operator
with check (
  exists (
    select 1
    from public.places
    where places.id = place_canonical_corrections.place_id
      and places.status = 'active'
      and places.google_place_id is not null
  )
);

create function public.kc3_canonical_correction_place_json(
  target_place_id uuid
)
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
    'addressPrecision', places.address_precision,
    'placeType', places.place_type,
    'status', places.status,
    'placeUpdatedAt', places.updated_at,
    'googlePlaceId', places.google_place_id,
    'googleName', google.google_name,
    'googleAddress', google.google_address,
    'googlePrimaryType', google.google_primary_type,
    'googleTypes', coalesce(to_jsonb(google.google_types), '[]'::jsonb),
    'googleBusinessStatus', google.google_business_status,
    'googleFetchedAt', google.google_fetched_at
  )
  from public.places as places
  join public.place_google_data as google on google.place_id = places.id
  where places.id = target_place_id
    and places.status = 'active'
    and places.google_place_id is not null;
$$;

revoke execute on function public.kc3_canonical_correction_place_json(uuid)
from public, anon, authenticated, service_role;
alter function public.kc3_canonical_correction_place_json(uuid)
owner to kc3_canonical_correction_operator;

create function public.kc3_search_places_for_canonical_correction(
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
      public.kc3_canonical_correction_place_json(places.id)
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

comment on function public.kc3_search_places_for_canonical_correction(text, text) is
  'Server-only active/provider-backed identity search for attended canonical correction.';

revoke execute on function public.kc3_search_places_for_canonical_correction(text, text)
from public, anon, authenticated;
alter function public.kc3_search_places_for_canonical_correction(text, text)
owner to kc3_canonical_correction_operator;
grant execute on function public.kc3_search_places_for_canonical_correction(text, text)
to service_role;

create function public.kc3_correct_canonical_place(
  target_place_id uuid,
  payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  supplied_canonical jsonb;
  supplied_evidence jsonb;
  expected_updated_at text;
  current_name text;
  current_address text;
  current_address_precision public.address_precision;
  current_place_type public.place_type;
  current_updated_at timestamptz;
  before_values jsonb;
  after_values jsonb;
  observed_on date;
begin
  if payload is null or jsonb_typeof(payload) <> 'object'
    or payload - array['expectedUpdatedAt', 'canonical', 'evidence'] <> '{}'::jsonb
    or not payload ?& array['expectedUpdatedAt', 'canonical', 'evidence']
    or jsonb_typeof(payload -> 'expectedUpdatedAt') <> 'string'
    or jsonb_typeof(payload -> 'canonical') <> 'object'
    or jsonb_typeof(payload -> 'evidence') <> 'object'
  then
    raise exception using errcode = '22023', message = 'canonical correction payload has unsupported or missing fields';
  end if;

  expected_updated_at := payload ->> 'expectedUpdatedAt';
  supplied_canonical := payload -> 'canonical';
  supplied_evidence := payload -> 'evidence';

  if btrim(expected_updated_at) = ''
    or supplied_canonical - array['name', 'address', 'addressPrecision', 'placeType'] <> '{}'::jsonb
    or not supplied_canonical ?& array['name', 'address', 'addressPrecision', 'placeType']
    or exists (
      select 1
      from jsonb_each(supplied_canonical) as canonical(key, value)
      where jsonb_typeof(canonical.value) <> 'string'
    )
    or btrim(supplied_canonical ->> 'name') = ''
    or btrim(supplied_canonical ->> 'address') = ''
    or supplied_canonical ->> 'addressPrecision' not in ('street_address', 'approximate', 'unknown')
    or supplied_canonical ->> 'placeType' not in ('coffee_shop', 'cafe', 'boba_tea', 'library', 'coworking', 'park')
  then
    raise exception using errcode = '22023', message = 'canonical correction values are invalid';
  end if;

  if supplied_evidence - array['sourceUrl', 'observedOn', 'notes'] <> '{}'::jsonb
    or not supplied_evidence ?& array['sourceUrl', 'observedOn', 'notes']
    or exists (
      select 1
      from jsonb_each(supplied_evidence) as evidence(key, value)
      where jsonb_typeof(evidence.value) <> 'string'
    )
    or supplied_evidence ->> 'sourceUrl' !~ '^https://[^[:space:]]+$'
    or supplied_evidence ->> 'observedOn' !~ '^\d{4}-\d{2}-\d{2}$'
    or btrim(supplied_evidence ->> 'notes') = ''
  then
    raise exception using errcode = '22023', message = 'canonical correction evidence is invalid';
  end if;

  observed_on := (supplied_evidence ->> 'observedOn')::date;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_place_id::text, 12633427)
  );

  select name, address, address_precision, place_type, updated_at
  into
    current_name,
    current_address,
    current_address_precision,
    current_place_type,
    current_updated_at
  from public.places
  where id = target_place_id
    and status = 'active'
    and google_place_id is not null
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'active provider-backed place not found';
  end if;

  if current_updated_at::text is distinct from expected_updated_at then
    raise exception using errcode = '40001', message = 'canonical place changed after selection';
  end if;

  before_values := jsonb_build_object(
    'name', current_name,
    'address', current_address,
    'addressPrecision', current_address_precision,
    'placeType', current_place_type
  );
  after_values := jsonb_build_object(
    'name', btrim(supplied_canonical ->> 'name'),
    'address', btrim(supplied_canonical ->> 'address'),
    'addressPrecision', supplied_canonical ->> 'addressPrecision',
    'placeType', supplied_canonical ->> 'placeType'
  );

  if before_values = after_values then
    raise exception using errcode = '22023', message = 'canonical correction does not change any value';
  end if;

  update public.places
  set
    name = after_values ->> 'name',
    address = after_values ->> 'address',
    address_precision = (after_values ->> 'addressPrecision')::public.address_precision,
    place_type = (after_values ->> 'placeType')::public.place_type
  where id = target_place_id;

  insert into public.place_canonical_corrections (
    place_id, before_values, after_values, source_url, source_observed_on,
    correction_notes
  ) values (
    target_place_id,
    before_values,
    after_values,
    supplied_evidence ->> 'sourceUrl',
    observed_on,
    btrim(supplied_evidence ->> 'notes')
  );

  return public.kc3_canonical_correction_place_json(target_place_id);
end;
$$;

comment on function public.kc3_correct_canonical_place(uuid, jsonb) is
  'Server-only atomic canonical correction with required immutable evidence.';

revoke execute on function public.kc3_correct_canonical_place(uuid, jsonb)
from public, anon, authenticated;
alter function public.kc3_correct_canonical_place(uuid, jsonb)
owner to kc3_canonical_correction_operator;
grant execute on function public.kc3_correct_canonical_place(uuid, jsonb)
to service_role;

revoke create on schema public from kc3_canonical_correction_operator;
revoke kc3_canonical_correction_operator from postgres;
