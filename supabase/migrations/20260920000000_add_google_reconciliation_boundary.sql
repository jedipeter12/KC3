-- KC3-27 adds the reviewed seed-to-provider reconciliation step that KC3-25
-- deliberately deferred. The wrapper attaches one explicitly selected Google
-- identity and runs the existing import in the same transaction, so a failed
-- provider write cannot leave a source identity without its source metadata.

create function public.kc3_reconcile_google_place(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  incoming_google_place_id text;
  expected_place_id uuid;
  provider_place_id uuid;
  locked_place_id uuid;
begin
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception using errcode = '22023', message = 'import payload must be an object';
  end if;

  if payload ? 'expectedPlaceId' and payload -> 'expectedPlaceId' <> 'null'::jsonb then
    if jsonb_typeof(payload -> 'googlePlaceId') <> 'string'
      or btrim(payload ->> 'googlePlaceId') = ''
      or jsonb_typeof(payload -> 'expectedPlaceId') <> 'string'
    then
      raise exception using errcode = '22023', message = 'reconciliation identity is invalid';
    end if;

    incoming_google_place_id := payload ->> 'googlePlaceId';
    expected_place_id := (payload ->> 'expectedPlaceId')::uuid;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(incoming_google_place_id, 12633425)
    );

    select places.id
    into provider_place_id
    from public.places as places
    where places.google_place_id = incoming_google_place_id
    for update;

    if provider_place_id is not null and provider_place_id <> expected_place_id then
      raise exception using errcode = '40001', message = 'provider identity changed during reconciliation';
    end if;

    if provider_place_id is null then
      select places.id
      into locked_place_id
      from public.places as places
      where places.id = expected_place_id
        and places.google_place_id is null
      for update;

      if locked_place_id is null then
        raise exception using errcode = '40001', message = 'reconciliation target changed during planning';
      end if;

      update public.places as places
      set google_place_id = incoming_google_place_id
      where places.id = locked_place_id;
    end if;
  end if;

  return public.kc3_import_google_place(payload);
end;
$$;

comment on function public.kc3_reconcile_google_place(jsonb) is
  'Server-only atomic reviewed identity attachment plus normalized Google import.';

revoke all on function public.kc3_reconcile_google_place(jsonb)
from public, anon, authenticated, service_role;
grant execute on function public.kc3_reconcile_google_place(jsonb) to service_role;

grant kc3_google_importer to postgres;
grant create on schema public to kc3_google_importer;
alter function public.kc3_reconcile_google_place(jsonb) owner to kc3_google_importer;
revoke create on schema public from kc3_google_importer;
revoke kc3_google_importer from postgres;
