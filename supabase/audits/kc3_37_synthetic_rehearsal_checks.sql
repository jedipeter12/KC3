-- Run only in the disposable KC3_37_Synthetic_Rehearsal project after CLI staging.
-- Every probe runs inside a transaction that ends in rollback.
begin;
do $$
declare
  staged public.overture_review_batches%rowtype;
  candidate jsonb;
  probe_id uuid := '99999999-9999-4999-8999-999999999999';
begin
  if (select count(*) from public.overture_review_batches) <> 1 then
    raise exception 'expected exactly one staged batch';
  end if;
  if (select count(*) from public.places) <> 1
    or (select count(*) from public.place_details) <> 1
    or (select count(*) from public.place_hours where source = 'kc3') <> 1
    or (select count(*) from public.place_overrides) <> 1
    or (select count(*) from public.place_canonical_corrections) <> 1
    or (select count(*) from public.place_google_data) <> 0 then
    raise exception 'synthetic canonical/protected counts changed';
  end if;
  select * into staged from public.overture_review_batches limit 1;
  candidate := jsonb_build_object(
    'schemaVersion', 1, 'batchId', probe_id, 'release', staged.release,
    'manifestSha256', staged.manifest_sha256, 'records', staged.records
  );
  begin
    perform public.kc3_stage_overture_review(
      jsonb_set(candidate, '{records,1,identity,address}', '""')
    );
    raise exception 'malformed second record was accepted';
  exception when sqlstate '22023' then
    raise notice 'PASS malformed second record rejected atomically';
  end;
  if exists (select 1 from public.overture_review_batches where batch_id = probe_id) then
    raise exception 'partial malformed batch was staged';
  end if;
  begin
    perform public.kc3_stage_overture_review(
      jsonb_set(
        jsonb_set(candidate, '{batchId}', to_jsonb(staged.batch_id::text)),
        '{records,0,identity,name}', '"Synthetic changed name"'
      )
    );
    raise exception 'same batch ID with changed content was accepted';
  exception when sqlstate '40001' then
    raise notice 'PASS same batch ID with changed content rejected';
  end;
  if public.kc3_stage_overture_review(candidate)->>'action' <> 'staged' then
    raise exception 'rollback probe did not stage';
  end if;
  if not exists (select 1 from public.overture_review_batches where batch_id = probe_id) then
    raise exception 'rollback probe invisible inside transaction';
  end if;
  raise notice 'PASS valid probe staged inside rollback transaction';
end;
$$;
rollback;
select case when count(*) = 1 then 'PASS rollback removed probe batch'
  else 'FAIL rollback left probe batch' end as rollback_result
from public.overture_review_batches;
