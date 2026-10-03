-- Reviewed Overture content is staged privately before directory reconciliation.
-- This boundary never changes places, details, hours, overrides, or history.
create table public.overture_review_batches (
  batch_id uuid primary key,
  release text not null,
  manifest_sha256 text not null check (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  records jsonb not null check (jsonb_typeof(records) = 'array'),
  created_at timestamptz not null default now()
);
alter table public.overture_review_batches enable row level security;
revoke all on public.overture_review_batches from public, anon, authenticated, service_role;

create role kc3_overture_review_importer nologin noinherit nosuperuser
  nocreatedb nocreaterole noreplication nobypassrls;
grant usage on schema public to kc3_overture_review_importer;
grant select, insert on public.overture_review_batches to kc3_overture_review_importer;
grant select (id) on public.places to kc3_overture_review_importer;
create policy overture_staging_reads on public.overture_review_batches
  for select to kc3_overture_review_importer using (true);
create policy overture_staging_inserts on public.overture_review_batches
  for insert to kc3_overture_review_importer with check (true);
create policy overture_staging_reads_target_ids on public.places
  for select to kc3_overture_review_importer using (true);

create function public.kc3_stage_overture_review(batch jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  incoming_id uuid;
  incoming_records jsonb;
  existing public.overture_review_batches%rowtype;
  record jsonb;
  evidence jsonb;
  source jsonb;
  period jsonb;
  target_id uuid;
begin
  if batch is null or jsonb_typeof(batch) <> 'object'
    or batch -> 'schemaVersion' is distinct from '1'::jsonb
    or jsonb_typeof(batch -> 'batchId') is distinct from 'string'
    or jsonb_typeof(batch -> 'release') is distinct from 'string'
    or batch ->> 'release' <> '2026-09-23.1'
    or coalesce(batch ->> 'manifestSha256', '') !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(batch -> 'records') is distinct from 'array'
  then raise exception using errcode = '22023', message = 'invalid review batch'; end if;
  incoming_id := (batch ->> 'batchId')::uuid;
  incoming_records := batch -> 'records';
  if jsonb_array_length(incoming_records) not between 1 and 1000 then
    raise exception using errcode = '22023', message = 'review batch must contain 1-1000 records';
  end if;
  if (select count(distinct value ->> 'overtureId') from jsonb_array_elements(incoming_records))
      <> jsonb_array_length(incoming_records) then
    raise exception using errcode = '22023', message = 'duplicate or missing external identity';
  end if;
  if (select count(*) from jsonb_array_elements(incoming_records) where value ->> 'targetPlaceId' is not null)
      <> (select count(distinct value ->> 'targetPlaceId') from jsonb_array_elements(incoming_records)) then
    raise exception using errcode = '22023', message = 'duplicate KC3 target identity';
  end if;
  for record in select value from jsonb_array_elements(incoming_records) loop
    perform (record ->> 'overtureId')::uuid;
    if jsonb_typeof(record -> 'identity') is distinct from 'object'
      or coalesce(btrim(record #>> '{identity,name}'), '') = ''
      or coalesce(btrim(record #>> '{identity,address}'), '') = ''
      or coalesce(record #>> '{identity,city}', '') not in ('Lenexa', 'Overland Park', 'Olathe')
      or coalesce(record #>> '{identity,placeType}', '') not in ('coffee_shop', 'cafe', 'boba_tea', 'library', 'coworking', 'park')
      or coalesce(record #>> '{identity,status}', '') not in ('active', 'temporarily_closed', 'permanently_closed', 'hidden')
      or coalesce(record #>> '{identity,addressPrecision}', '') not in ('unknown', 'approximate', 'street_address')
      or jsonb_typeof(record #> '{identity,latitude}') is distinct from 'number'
      or jsonb_typeof(record #> '{identity,longitude}') is distinct from 'number'
    then raise exception using errcode = '22023', message = 'invalid reviewed identity'; end if;
    if (record #>> '{identity,latitude}')::numeric not between -90 and 90
      or (record #>> '{identity,longitude}')::numeric not between -180 and 180
      or coalesce(record #>> '{identity,timeZone}', '') = '' then
      raise exception using errcode = '22023', message = 'invalid coordinates or timezone';
    end if;
    perform pg_catalog.timezone(record #>> '{identity,timeZone}', statement_timestamp());
    if record ->> 'targetPlaceId' is not null then
      target_id := (record ->> 'targetPlaceId')::uuid;
      if not exists (select 1 from public.places where places.id = target_id) then
        raise exception using errcode = '22023', message = 'KC3 target identity not found';
      end if;
    end if;
    if jsonb_typeof(record -> 'source') is distinct from 'object'
      or record #>> '{source,id}' is distinct from record ->> 'overtureId'
      or jsonb_typeof(record #> '{source,sources}') is distinct from 'array'
    then raise exception using errcode = '22023', message = 'source provenance is missing'; end if;
    if jsonb_array_length(record #> '{source,sources}') = 0 then
      raise exception using errcode = '22023', message = 'source provenance is empty';
    end if;
    for source in select value from jsonb_array_elements(record #> '{source,sources}') loop
      if coalesce(source ->> 'license', '') not in ('CDLA-Permissive-2.0', 'Apache-2.0', 'CC0-1.0')
        or coalesce(btrim(source ->> 'dataset'), '') = '' then
        raise exception using errcode = '22023', message = 'unapproved source license';
      end if;
    end loop;
    for evidence in select record -> 'identityEvidence'
      union all select record -> 'hours' where record -> 'hours' <> 'null'::jsonb loop
      if jsonb_typeof(evidence) is distinct from 'object'
        or coalesce(evidence ->> 'sourceUrl', '') !~ '^https://[^[:space:]]+$'
        or coalesce(evidence ->> 'observedOn', '') !~ '^\d{4}-\d{2}-\d{2}$'
        or coalesce(evidence ->> 'reuseBasis', '') not in ('Overture license', 'Business supplied', 'Permitted source')
      then raise exception using errcode = '22023', message = 'invalid source evidence'; end if;
      if (evidence ->> 'observedOn')::date > current_date
        or ((evidence ->> 'observedOn')::date)::text <> evidence ->> 'observedOn' then
        raise exception using errcode = '22023', message = 'invalid evidence date';
      end if;
      if evidence ->> 'reuseBasis' <> 'Overture license'
        and coalesce(btrim(evidence ->> 'notes'), '') = '' then
        raise exception using errcode = '22023', message = 'independent permission/source notes required';
      end if;
    end loop;
    if record -> 'hours' is distinct from 'null'::jsonb then
      if record -> 'hours' is null
        or record #>> '{hours,reuseBasis}' = 'Overture license'
        or jsonb_typeof(record #> '{hours,periods}') is distinct from 'array' then
        raise exception using errcode = '22023', message = 'invalid hours provenance';
      end if;
      if (select count(distinct value ->> 'dayOfWeek') from jsonb_array_elements(record #> '{hours,periods}')) <> 7 then
        raise exception using errcode = '22023', message = 'complete reviewed week required';
      end if;
      for period in select value from jsonb_array_elements(record #> '{hours,periods}') loop
        if coalesce(period ->> 'dayOfWeek', '') !~ '^[0-6]$'
          or jsonb_typeof(period -> 'isClosed') is distinct from 'boolean'
          or jsonb_typeof(period -> 'closesNextDay') is distinct from 'boolean' then
          raise exception using errcode = '22023', message = 'invalid hours day/flags';
        end if;
        if period -> 'isClosed' = 'true'::jsonb then
          if period -> 'openTime' is distinct from 'null'::jsonb
            or period -> 'closeTime' is distinct from 'null'::jsonb
            or period -> 'closesNextDay' <> 'false'::jsonb then
            raise exception using errcode = '22023', message = 'closed day must have no times';
          end if;
        else
          if coalesce(period ->> 'openTime', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
            or coalesce(period ->> 'closeTime', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
            raise exception using errcode = '22023', message = 'invalid hours clock time';
          end if;
        end if;
      end loop;
    end if;
  end loop;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(incoming_id::text, 126337));
  select * into existing from public.overture_review_batches where batch_id = incoming_id;
  if found then
    if existing.records <> incoming_records or existing.release <> batch ->> 'release'
      or existing.manifest_sha256 <> batch ->> 'manifestSha256' then
      raise exception using errcode = '40001', message = 'batch ID already contains different reviewed content';
    end if;
    return jsonb_build_object('batchId', incoming_id, 'count', jsonb_array_length(incoming_records), 'action', 'unchanged');
  end if;
  insert into public.overture_review_batches (batch_id, release, manifest_sha256, records)
    values (incoming_id, batch ->> 'release', batch ->> 'manifestSha256', incoming_records);
  return jsonb_build_object('batchId', incoming_id, 'count', jsonb_array_length(incoming_records), 'action', 'staged');
end;
$$;
revoke all on function public.kc3_stage_overture_review(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.kc3_stage_overture_review(jsonb) to service_role;
comment on table public.overture_review_batches is
  'Private append-only reviewed licensed candidates, not published directory or KC3 verification.';
comment on function public.kc3_stage_overture_review(jsonb) is
  'Service-only validated, atomic, repeatable Overture review staging. Never modifies canonical/KC3/provider/history data.';
grant kc3_overture_review_importer to postgres;
grant create on schema public to kc3_overture_review_importer;
alter function public.kc3_stage_overture_review(jsonb) owner to kc3_overture_review_importer;
revoke create on schema public from kc3_overture_review_importer;
revoke kc3_overture_review_importer from postgres;
