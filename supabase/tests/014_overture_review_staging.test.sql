begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(20);
create temporary table original_staging_count as
select count(*)::integer as count from public.overture_review_batches;
create function pg_temp.review_batch() returns jsonb language sql as $$
select '{
  "schemaVersion":1,"batchId":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  "release":"2026-09-23.1","manifestSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "records":[{
    "overtureId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","targetPlaceId":null,
    "identity":{"name":"Review fixture","city":"Lenexa","address":"1 Main St","placeType":"coffee_shop","status":"active","addressPrecision":"unknown","latitude":38.9,"longitude":-94.7,"timeZone":"America/Chicago","website":null,"postcode":null},
    "identityEvidence":{"sourceUrl":"https://docs.overturemaps.org/getting-data/duckdb/","observedOn":"2026-10-02","reuseBasis":"Overture license","notes":""},
    "source":{"id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","sources":[{"dataset":"meta","license":"CDLA-Permissive-2.0"}]},
    "hours":null
  }]
}'::jsonb;
$$;
select ok(not has_table_privilege('anon','public.overture_review_batches','select'), 'anon cannot read staging');
select ok(not has_table_privilege('authenticated','public.overture_review_batches','select'), 'authenticated cannot read staging');
select ok(not has_table_privilege('service_role','public.overture_review_batches','insert'), 'service role has no direct staging writes');
select ok(not has_function_privilege('anon','public.kc3_stage_overture_review(jsonb)','execute'), 'anon cannot stage');
select ok(not has_function_privilege('authenticated','public.kc3_stage_overture_review(jsonb)','execute'), 'authenticated cannot stage');
select ok(has_function_privilege('service_role','public.kc3_stage_overture_review(jsonb)','execute'), 'service role may execute staged boundary');
select ok(not has_column_privilege('kc3_overture_review_importer','public.places','name','update'), 'owner cannot rewrite canonical fields');
select ok(not has_table_privilege('kc3_overture_review_importer','public.place_details','update'), 'owner cannot rewrite KC3 details');
select throws_ok($$select public.kc3_stage_overture_review(null)$$,'22023','invalid review batch','null payload rejected');
select throws_ok($$select public.kc3_stage_overture_review(jsonb_set(pg_temp.review_batch(),'{records}','[]'))$$,'22023','review batch must contain 1-1000 records','empty batch rejected');
select throws_ok($$select public.kc3_stage_overture_review(jsonb_set(pg_temp.review_batch(),'{records,0,identity,address}','""'))$$,'22023','invalid reviewed identity','missing required field rejected');
select throws_ok($$select public.kc3_stage_overture_review(jsonb_set(pg_temp.review_batch(),'{records,0,source,sources,0,license}','"unreviewed"'))$$,'22023','unapproved source license','unknown source license rejected');
select throws_ok($$select public.kc3_stage_overture_review(jsonb_set(pg_temp.review_batch(),'{records,0,targetPlaceId}','"cccccccc-cccc-cccc-cccc-cccccccccccc"'))$$,'22023','KC3 target identity not found','unknown KC3 target rejected');
select is(public.kc3_stage_overture_review(pg_temp.review_batch())->>'action','staged','valid batch staged');
select is(public.kc3_stage_overture_review(pg_temp.review_batch())->>'action','unchanged','same batch repeats without mutation');
select throws_ok($$select public.kc3_stage_overture_review(jsonb_set(pg_temp.review_batch(),'{records,0,identity,name}','"Different name"'))$$,'40001','batch ID already contains different reviewed content','batch identity cannot overwrite prior reviewed content');
select is((select count(*)::integer from public.overture_review_batches),(select count + 1 from original_staging_count),'invalid batches leave no partial staging rows');
select ok(not exists(select 1 from public.places where name='Review fixture'), 'staging never publishes or inserts canonical records');
insert into public.places (id, name, city, address, place_type)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Synthetic target', 'Lenexa', '1 Fixture Way', 'cafe');
create function pg_temp.case_variant_target_batch() returns jsonb language sql as $$
with original as (select pg_temp.review_batch() as batch),
two_records as (
  select
    jsonb_set(batch->'records'->0, '{targetPlaceId}', '"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"') as first_record,
    jsonb_set(
      jsonb_set(
        jsonb_set(batch->'records'->0, '{overtureId}', '"dddddddd-dddd-4ddd-8ddd-dddddddddddd"'),
        '{source,id}', '"dddddddd-dddd-4ddd-8ddd-dddddddddddd"'
      ),
      '{targetPlaceId}', '"AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA"'
    ) as second_record,
    batch
  from original
)
select jsonb_set(
  jsonb_set(batch, '{batchId}', '"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"'),
  '{records}', jsonb_build_array(first_record, second_record)
)
from two_records;
$$;
select throws_ok(
  $$select public.kc3_stage_overture_review(pg_temp.case_variant_target_batch())$$,
  '22023', 'duplicate KC3 target identity',
  'case-variant KC3 UUID mappings cannot stage as two distinct targets'
);
create function pg_temp.case_variant_overture_batch() returns jsonb language sql as $$
with original as (select pg_temp.review_batch() as batch),
two_records as (
  select
    batch->'records'->0 as first_record,
    jsonb_set(
      jsonb_set(batch->'records'->0, '{overtureId}', '"AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA"'),
      '{source,id}', '"AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA"'
    ) as second_record,
    batch
  from original
)
select jsonb_set(
  jsonb_set(batch, '{batchId}', '"ffffffff-ffff-4fff-8fff-ffffffffffff"'),
  '{records}', jsonb_build_array(first_record, second_record)
)
from two_records;
$$;
select throws_ok(
  $$select public.kc3_stage_overture_review(pg_temp.case_variant_overture_batch())$$,
  '22023', 'duplicate or missing external identity',
  'case-variant Overture UUIDs cannot stage as distinct identities'
);
select * from finish();
rollback;
