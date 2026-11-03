-- KC3-37: publication is an explicit, reviewed transaction. Migration alone
-- publishes nothing and does not rewrite the curated directory.
create table public.place_publications (
  place_id uuid primary key references public.places(id) on delete restrict,
  overture_id uuid not null unique,
  batch_id uuid not null references public.overture_review_batches(batch_id),
  identity_evidence jsonb not null,
  hours_evidence jsonb,
  field_provenance jsonb not null,
  source_record jsonb not null,
  review_notes text not null check (btrim(review_notes) <> ''),
  published_at timestamptz not null default now(),
  check (jsonb_typeof(identity_evidence) = 'object'),
  check (hours_evidence is null or jsonb_typeof(hours_evidence) = 'object'),
  check (jsonb_typeof(field_provenance) = 'object'),
  check (jsonb_typeof(source_record) = 'object')
);
alter table public.place_publications enable row level security;
revoke all on public.place_publications from public, anon, authenticated, service_role;

create role kc3_overture_publisher nologin noinherit nosuperuser
  nocreatedb nocreaterole noreplication nobypassrls;
grant usage on schema public to kc3_overture_publisher;
grant select on public.overture_review_batches to kc3_overture_publisher;
grant select, insert on public.place_publications to kc3_overture_publisher;
grant select, insert, update on public.places to kc3_overture_publisher;
grant select, delete on public.place_google_data to kc3_overture_publisher;
grant select, insert, delete on public.place_hours to kc3_overture_publisher;
grant select on public.place_canonical_corrections to kc3_overture_publisher;
grant select on public.place_details to kc3_overture_publisher;
grant select on public.place_overrides to kc3_overture_publisher;
grant usage on type public.place_type, public.place_status,
  public.address_precision, public.hours_source to kc3_overture_publisher;
create policy overture_publisher_reads_batches on public.overture_review_batches
  for select to kc3_overture_publisher using (true);
create policy overture_publisher_reads_publications on public.place_publications
  for select to kc3_overture_publisher using (true);
create policy overture_publisher_inserts_publications on public.place_publications
  for insert to kc3_overture_publisher with check (true);
create policy overture_publisher_reads_places on public.places
  for select to kc3_overture_publisher using (true);
create policy overture_publisher_inserts_places on public.places
  for insert to kc3_overture_publisher with check (true);
create policy overture_publisher_updates_places on public.places
  for update to kc3_overture_publisher using (true) with check (true);
create policy overture_publisher_reads_google on public.place_google_data
  for select to kc3_overture_publisher using (true);
create policy overture_publisher_deletes_google on public.place_google_data
  for delete to kc3_overture_publisher using (true);
create policy overture_publisher_reads_hours on public.place_hours
  for select to kc3_overture_publisher using (true);
create policy overture_publisher_inserts_hours on public.place_hours
  for insert to kc3_overture_publisher with check (source = 'kc3');
create policy overture_publisher_deletes_hours on public.place_hours
  for delete to kc3_overture_publisher using (source = 'google');
create policy overture_publisher_reads_corrections on public.place_canonical_corrections
  for select to kc3_overture_publisher using (true);
create policy overture_publisher_reads_details on public.place_details
  for select to kc3_overture_publisher using (true);
create policy overture_publisher_reads_overrides on public.place_overrides
  for select to kc3_overture_publisher using (true);

-- Retire old server RPCs as their owning role; revoking from the migration
-- role alone does not remove grants made by kc3_google_importer.
grant kc3_google_importer to postgres;
set role kc3_google_importer;
revoke execute on function public.kc3_import_google_place(jsonb)
  from public, anon, authenticated, service_role;
revoke execute on function public.kc3_reconcile_google_place(jsonb)
  from public, anon, authenticated, service_role;
revoke execute on function public.kc3_google_import_state()
  from public, anon, authenticated, service_role;
reset role;
revoke kc3_google_importer from postgres;

-- Direct privileged restores must be audited before access is reopened.
-- Guard ordinary SQL/API writes as well as the retired RPCs.
create function public.kc3_reject_google_content()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = '42501', message = 'Google content import is retired';
end;
$$;
revoke all on function public.kc3_reject_google_content()
  from public, anon, authenticated, service_role;
create trigger reject_google_place_id
  before insert or update of google_place_id on public.places
  for each row when (new.google_place_id is not null)
  execute function public.kc3_reject_google_content();
create trigger reject_google_provider_copy
  before insert or update on public.place_google_data
  for each row execute function public.kc3_reject_google_content();
create trigger reject_google_hours
  before insert or update on public.place_hours
  for each row when (new.source = 'google')
  execute function public.kc3_reject_google_content();

create function public.kc3_publish_overture_place(
  reviewed_batch_id uuid, reviewed_overture_id uuid,
  confirmed_target_id uuid, expected_updated_at timestamptz,
  municipal_eligibility_confirmed boolean,
  duplicate_review_confirmed boolean,
  review_notes text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  reviewed jsonb;
  identity jsonb;
  target_id uuid;
  existing public.places%rowtype;
  schedule jsonb;
  hour_row jsonb;
begin
  if municipal_eligibility_confirmed is distinct from true
    or duplicate_review_confirmed is distinct from true
    or coalesce(btrim(review_notes), '') = '' then
    raise exception using errcode = '22023', message = 'publication review incomplete';
  end if;
  select value into reviewed
  from public.overture_review_batches as batches,
    jsonb_array_elements(batches.records) as rows(value)
  where batches.batch_id = reviewed_batch_id
    and rows.value ->> 'overtureId' = reviewed_overture_id::text;
  if reviewed is null then
    raise exception using errcode = '22023', message = 'reviewed record not staged';
  end if;
  if (reviewed ->> 'targetPlaceId')::uuid is distinct from confirmed_target_id then
    raise exception using errcode = '22023', message = 'KC3 identity confirmation differs';
  end if;
  identity := reviewed -> 'identity';
  if coalesce(identity ->> 'city', '') not in ('Lenexa','Overland Park','Olathe')
    or coalesce(identity ->> 'status', '') not in
      ('active','temporarily_closed','permanently_closed','hidden')
    or reviewed #>> '{source,id}' is distinct from reviewed ->> 'overtureId'
    or reviewed #>> '{identityEvidence,reuseBasis}' not in
      ('Overture license','Business supplied','Permitted source') then
    raise exception using errcode = '22023', message = 'reviewed identity invalid';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(reviewed_overture_id::text, 126337));
  if exists (select 1 from public.place_publications
      where overture_id = reviewed_overture_id) then
    raise exception using errcode = '23505', message = 'Overture identity already published';
  end if;
  if confirmed_target_id is not null then
    select * into existing from public.places
      where id = confirmed_target_id for update;
    if not found or expected_updated_at is distinct from existing.updated_at
      or exists (select 1 from public.place_publications
        where place_id = confirmed_target_id)
      or existing.moved_to_place_id is not null
      or (existing.status = 'hidden' and identity ->> 'status' <> 'hidden')
      or exists (select 1 from public.place_canonical_corrections
        where place_id = confirmed_target_id)
      or exists (select 1 from public.place_overrides
        where place_id = confirmed_target_id)
      or (reviewed -> 'hours' <> 'null'::jsonb and exists
        (select 1 from public.place_hours where place_id = confirmed_target_id
          and source = 'kc3')) then
      raise exception using errcode = '40001', message = 'KC3 target requires separate reconciliation';
    end if;
    target_id := existing.id;
    update public.places set
      name = identity ->> 'name', city = identity ->> 'city',
      address = identity ->> 'address',
      address_precision = (identity ->> 'addressPrecision')::public.address_precision,
      place_type = (identity ->> 'placeType')::public.place_type,
      status = (identity ->> 'status')::public.place_status,
      latitude = (identity ->> 'latitude')::numeric,
      longitude = (identity ->> 'longitude')::numeric,
      time_zone = identity ->> 'timeZone', google_place_id = null
    where id = target_id;
    delete from public.place_google_data where place_id = target_id;
    delete from public.place_hours where place_id = target_id and source = 'google';
  else
    if expected_updated_at is not null then
      raise exception using errcode = '22023', message = 'new identity has no prior version';
    end if;
    insert into public.places (
      name, city, address, address_precision, place_type, status,
      latitude, longitude, time_zone
    ) values (
      identity ->> 'name', identity ->> 'city', identity ->> 'address',
      (identity ->> 'addressPrecision')::public.address_precision,
      (identity ->> 'placeType')::public.place_type,
      (identity ->> 'status')::public.place_status,
      (identity ->> 'latitude')::numeric,
      (identity ->> 'longitude')::numeric,
      identity ->> 'timeZone'
    ) returning id into target_id;
  end if;
  schedule := reviewed -> 'hours';
  if schedule is not null and schedule <> 'null'::jsonb then
    if schedule ->> 'reuseBasis' = 'Overture license'
      or jsonb_typeof(schedule -> 'periods') <> 'array'
      or (select count(distinct value ->> 'dayOfWeek')
          from jsonb_array_elements(schedule -> 'periods')) <> 7 then
      raise exception using errcode = '22023', message = 'independent schedule required';
    end if;
    for hour_row in select value from jsonb_array_elements(schedule -> 'periods') loop
      insert into public.place_hours (
        place_id, day_of_week, open_time, close_time, is_closed,
        closes_next_day, source, source_observed_at
      ) values (
        target_id, (hour_row ->> 'dayOfWeek')::smallint,
        (hour_row ->> 'openTime')::time,
        (hour_row ->> 'closeTime')::time,
        (hour_row ->> 'isClosed')::boolean,
        (hour_row ->> 'closesNextDay')::boolean,
        'kc3', (schedule ->> 'observedOn')::date::timestamptz
      );
    end loop;
  end if;
  insert into public.place_publications (
    place_id, overture_id, batch_id, identity_evidence, hours_evidence,
    field_provenance, source_record, review_notes
  ) values (
    target_id, reviewed_overture_id, reviewed_batch_id,
    reviewed -> 'identityEvidence', nullif(reviewed -> 'hours', 'null'::jsonb),
    jsonb_build_object(
      'name', case when identity -> 'name' = reviewed #> '{source,name}'
        then 'Overture license' else reviewed #>> '{identityEvidence,reuseBasis}' end,
      'address', case when identity -> 'address' = reviewed #> '{source,address}'
        then 'Overture license' else reviewed #>> '{identityEvidence,reuseBasis}' end,
      'city', case when identity -> 'city' = reviewed #> '{source,city}'
        then 'Overture license' else reviewed #>> '{identityEvidence,reuseBasis}' end,
      'latitude', case when identity -> 'latitude' = reviewed #> '{source,latitude}'
        then 'Overture license' else reviewed #>> '{identityEvidence,reuseBasis}' end,
      'longitude', case when identity -> 'longitude' = reviewed #> '{source,longitude}'
        then 'Overture license' else reviewed #>> '{identityEvidence,reuseBasis}' end,
      'placeType', case when identity -> 'placeType' = reviewed #> '{source,placeType}'
        then 'reviewed Overture category mapping'
        else reviewed #>> '{identityEvidence,reuseBasis}' end,
      'status', reviewed #>> '{identityEvidence,reuseBasis}',
      'addressPrecision', 'KC3 review classification',
      'timeZone', 'KC3 regional rule'
    ),
    reviewed -> 'source', btrim(review_notes)
  );
  return jsonb_build_object('placeId', target_id, 'overtureId', reviewed_overture_id);
end;
$$;
revoke all on function public.kc3_publish_overture_place(
  uuid,uuid,uuid,timestamptz,boolean,boolean,text)
  from public, anon, authenticated, service_role;
grant execute on function public.kc3_publish_overture_place(
  uuid,uuid,uuid,timestamptz,boolean,boolean,text) to service_role;
grant kc3_overture_publisher to postgres;
grant create on schema public to kc3_overture_publisher;
alter function public.kc3_publish_overture_place(
  uuid,uuid,uuid,timestamptz,boolean,boolean,text)
  owner to kc3_overture_publisher;
revoke create on schema public from kc3_overture_publisher;
revoke kc3_overture_publisher from postgres;

-- Anonymous reads require both reviewed source provenance and the independent
-- MVP eligibility gate. Hours changes still pause visibility until reviewed.
-- Active legacy rows, including rows restored by an old seed, are invisible.
grant select on public.place_publications to kc3_public_place_reader;
create policy public_reader_reads_publications on public.place_publications
  for select to kc3_public_place_reader using (true);
drop policy public_place_reader_selects_active_places on public.places;
create policy public_place_reader_selects_published_places on public.places
  for select to kc3_public_place_reader using (
    status = 'active' and mvp_published
    and not public.kc3_hours_review_pending(id)
    and exists (
      select 1 from public.place_publications as publication
      where publication.place_id = places.id
    )
  );

create function public.get_public_place_attribution(target_place_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'source', 'Overture Maps',
    'sourceUrl', 'https://overturemaps.org/',
    'licenseUrl', 'https://docs.overturemaps.org/attribution/',
    'licenses', (select coalesce(jsonb_agg(distinct entry.value ->> 'license'), '[]'::jsonb)
      from jsonb_array_elements(publication.source_record -> 'sources') as entry(value)),
    'fieldSources', publication.field_provenance,
    'identityReviewedOn', publication.identity_evidence ->> 'observedOn',
    'hoursSourceUrl', publication.hours_evidence ->> 'sourceUrl'
  )
  from public.place_publications as publication
  join public.places as places on places.id = publication.place_id
  where publication.place_id = target_place_id and places.status = 'active';
$$;
revoke all on function public.get_public_place_attribution(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_public_place_attribution(uuid) to anon;
grant kc3_public_place_reader to postgres;
grant create on schema public to kc3_public_place_reader;
alter function public.get_public_place_attribution(uuid) owner to kc3_public_place_reader;
revoke create on schema public from kc3_public_place_reader;
revoke kc3_public_place_reader from postgres;

-- The client checks this before every list/detail read. On a pre-migration or
-- full pre-gate restore the RPC is absent, so it cannot label legacy content as
-- reviewed Overture data.
create function public.kc3_publication_gate_ready()
returns boolean language sql stable set search_path = '' as $$
  select true;
$$;
revoke all on function public.kc3_publication_gate_ready()
  from public, anon, authenticated, service_role;
grant execute on function public.kc3_publication_gate_ready() to anon;

-- Existing detail and correction operators retain their constrained KC3-owned
-- writes; their eligibility and context switch to published identities below.
grant select on public.place_publications to kc3_place_detail_operator,
  kc3_canonical_correction_operator;
grant update (field_provenance) on public.place_publications
  to kc3_canonical_correction_operator;
create policy detail_operator_reads_publications on public.place_publications
  for select to kc3_place_detail_operator using (true);
create policy correction_operator_reads_publications on public.place_publications
  for select to kc3_canonical_correction_operator using (true);
create policy correction_operator_updates_provenance on public.place_publications
  for update to kc3_canonical_correction_operator
  using (true) with check (true);

drop policy place_detail_operator_reads_active_provider_places on public.places;
create policy place_detail_operator_reads_published_places on public.places
  for select to kc3_place_detail_operator using (
    status = 'active' and exists (select 1 from public.place_publications
      where place_id = places.id));
drop policy place_detail_operator_reads_provider_identity on public.place_google_data;
drop policy place_detail_operator_reads_details on public.place_details;
create policy place_detail_operator_reads_details on public.place_details
  for select to kc3_place_detail_operator using (
    exists (select 1 from public.place_publications as publication
      join public.places as place on place.id = publication.place_id
      where publication.place_id = place_details.place_id
        and place.status = 'active'));
drop policy place_detail_operator_inserts_details on public.place_details;
create policy place_detail_operator_inserts_details on public.place_details
  for insert to kc3_place_detail_operator with check (
    exists (select 1 from public.place_publications as publication
      join public.places as place on place.id = publication.place_id
      where publication.place_id = place_details.place_id
        and place.status = 'active'));
drop policy place_detail_operator_updates_details on public.place_details;
create policy place_detail_operator_updates_details on public.place_details
  for update to kc3_place_detail_operator using (
    exists (select 1 from public.place_publications as publication
      join public.places as place on place.id = publication.place_id
      where publication.place_id = place_details.place_id
        and place.status = 'active'))
  with check (exists (select 1 from public.place_publications as publication
      join public.places as place on place.id = publication.place_id
      where publication.place_id = place_details.place_id
        and place.status = 'active'));
drop policy canonical_correction_operator_reads_active_provider_places on public.places;
create policy canonical_correction_operator_reads_published_places on public.places
  for select to kc3_canonical_correction_operator using (
    status = 'active' and exists (select 1 from public.place_publications
      where place_id = places.id));
drop policy canonical_correction_operator_updates_active_provider_places on public.places;
create policy canonical_correction_operator_updates_published_places on public.places
  for update to kc3_canonical_correction_operator using (
    status = 'active' and exists (select 1 from public.place_publications
      where place_id = places.id))
  with check (status = 'active' and exists (select 1 from public.place_publications
      where place_id = places.id));
drop policy canonical_correction_operator_reads_provider_context on public.place_google_data;
drop policy canonical_correction_operator_inserts_audit_rows on public.place_canonical_corrections;
create policy canonical_correction_operator_inserts_audit_rows
  on public.place_canonical_corrections for insert
  to kc3_canonical_correction_operator with check (
    exists (select 1 from public.place_publications as publication
      join public.places as place on place.id = publication.place_id
      where publication.place_id = place_canonical_corrections.place_id
        and place.status = 'active'));

grant kc3_place_detail_operator, kc3_canonical_correction_operator to postgres;
grant create on schema public to kc3_place_detail_operator,
  kc3_canonical_correction_operator;

create or replace function public.kc3_operator_place_json(target_place_id uuid)
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
    'overtureId', publication.overture_id::text,
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
  left join public.place_google_data as google on google.place_id = places.id
  join public.place_publications as publication on publication.place_id = places.id
  left join public.place_details as details on details.place_id = places.id
  where places.id = target_place_id
    and places.status = 'active'
    and exists (select 1 from public.place_publications as publication where publication.place_id = places.id);
$$;

create or replace function public.kc3_search_places_for_details(
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
    and exists (select 1 from public.place_publications as publication where publication.place_id = places.id)
    and btrim(name_query) <> ''
    and btrim(city_query) <> ''
    and places.name ilike '%' || btrim(name_query) || '%'
    and lower(places.city) = lower(btrim(city_query));
$$;

create or replace function public.kc3_upsert_place_details(
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
    and exists (select 1 from public.place_publications as publication where publication.place_id = target_place_id);
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

create or replace function public.kc3_canonical_correction_place_json(
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
    , 'overtureId', publication.overture_id::text
  )
  from public.places as places
  left join public.place_google_data as google on google.place_id = places.id
  join public.place_publications as publication on publication.place_id = places.id
  where places.id = target_place_id
    and places.status = 'active'
    and exists (select 1 from public.place_publications as publication where publication.place_id = places.id);
$$;

create or replace function public.kc3_search_places_for_canonical_correction(
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
    and exists (select 1 from public.place_publications as publication where publication.place_id = places.id)
    and btrim(name_query) <> ''
    and btrim(city_query) <> ''
    and places.name ilike '%' || btrim(name_query) || '%'
    and lower(places.city) = lower(btrim(city_query));
$$;

create or replace function public.kc3_correct_canonical_place_with_database_version(
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
    and exists (select 1 from public.place_publications as publication where publication.place_id = target_place_id)
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

  -- The immutable correction row contains the precise evidence. Mark each
  -- changed public field as KC3-corrected so later attribution never presents
  -- its old Overture origin as the current value's source.
  update public.place_publications as publication
  set field_provenance = publication.field_provenance || coalesce((
    select jsonb_object_agg(changed.key, 'KC3 correction')
    from jsonb_each(after_values) as changed(key, value)
    where changed.value is distinct from before_values -> changed.key
  ), '{}'::jsonb)
  where publication.place_id = target_place_id;

  return public.kc3_canonical_correction_place_json(target_place_id);
end;
$$;

revoke create on schema public from kc3_place_detail_operator,
  kc3_canonical_correction_operator;
revoke kc3_place_detail_operator, kc3_canonical_correction_operator from postgres;
