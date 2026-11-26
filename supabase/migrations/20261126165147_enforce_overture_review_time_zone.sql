-- KC3's three MVP cities share one regional time zone. Guard stored reviewed
-- batches, including direct inserts by the constrained importer role. This
-- forward migration also applies to stacks that already ran the staging schema.
do $$
begin
  if exists (
    select 1
    from public.overture_review_batches as batch,
      pg_catalog.jsonb_array_elements(batch.records) as item(value)
    where coalesce(item.value #>> '{identity,timeZone}', '') <> 'America/Chicago'
  ) then
    raise exception using errcode = '22023',
      message = 'existing reviewed batch has invalid regional time zone';
  end if;
end;
$$;

create function public.kc3_check_overture_review_time_zone()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  item jsonb;
begin
  if pg_catalog.jsonb_typeof(new.records) = 'array' then
    for item in select value from pg_catalog.jsonb_array_elements(new.records) loop
      if coalesce(item #>> '{identity,timeZone}', '') <> 'America/Chicago' then
        raise exception using errcode = '22023',
          message = 'invalid coordinates or timezone';
      end if;
    end loop;
  end if;
  return new;
end;
$$;

revoke all on function public.kc3_check_overture_review_time_zone()
  from public, anon, authenticated, service_role;

create trigger kc3_overture_review_time_zone
before insert or update of records on public.overture_review_batches
for each row execute function public.kc3_check_overture_review_time_zone();
