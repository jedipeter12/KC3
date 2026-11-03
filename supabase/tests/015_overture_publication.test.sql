begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(16);

insert into public.places (id, name, city, address, place_type)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Unreviewed legacy fixture',
  'Lenexa', '2 Main St', 'cafe');
insert into public.places (id, name, city, address, place_type, mvp_published)
values ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Reviewed target fixture',
  'Lenexa', '1 Main St', 'cafe', true);
select is((select count(*)::integer from public.list_public_place_summaries()), 0,
  'unreviewed canonical row is excluded from anonymous summaries');
select ok(not has_function_privilege('service_role',
  'public.kc3_import_google_place(jsonb)', 'execute'),
  'old Google import RPC is retired');
select ok(not has_function_privilege('service_role',
  'public.kc3_reconcile_google_place(jsonb)', 'execute'),
  'old Google reconciliation RPC is retired');
select throws_ok($$insert into public.places
  (name,city,address,place_type,google_place_id)
  values ('Blocked','Lenexa','3 Main St','cafe','old-google-id')$$,
  '42501', 'Google content import is retired',
  'direct old Google identity insert is blocked');
select updated_at::text as target_updated_at from public.places
where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd' \gset

set local role service_role;
select public.kc3_stage_overture_review('{
  "schemaVersion":1,"batchId":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  "release":"2026-09-23.1","manifestSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "records":[{
    "overtureId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","targetPlaceId":"dddddddd-dddd-dddd-dddd-dddddddddddd",
    "identity":{"name":"Fixture cafe","city":"Lenexa","address":"1 Main St","placeType":"cafe","status":"active","addressPrecision":"street_address","latitude":38.9,"longitude":-94.7,"timeZone":"America/Chicago","website":null,"postcode":null},
    "identityEvidence":{"sourceUrl":"https://docs.overturemaps.org/getting-data/duckdb/","observedOn":"2026-10-02","reuseBasis":"Overture license","notes":""},
    "source":{"id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","sources":[{"dataset":"meta","license":"CDLA-Permissive-2.0"}]},
    "hours":null
  }]
}'::jsonb);
select public.kc3_publish_overture_place(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'dddddddd-dddd-dddd-dddd-dddddddddddd', :'target_updated_at'::timestamptz,
  true, true, 'Fixture municipality and duplicate review');
do $$
begin
  perform public.kc3_publish_overture_place(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'dddddddd-dddd-dddd-dddd-dddddddddddd', null,
    true, true, 'Fixture municipality and duplicate review');
  raise exception 'duplicate publication accepted';
exception when unique_violation then null;
end;
$$;
do $$
begin
  if jsonb_array_length(public.kc3_search_places_for_details('Fixture','Lenexa')) <> 1
    or jsonb_array_length(public.kc3_search_places_for_canonical_correction('Fixture','Lenexa')) <> 1 then
    raise exception 'reviewed place missing from KC3 operators';
  end if;
end;
$$;
do $$
declare
  selected jsonb;
  target_id uuid;
begin
  selected := public.kc3_search_places_for_canonical_correction('Fixture','Lenexa')->0;
  target_id := (selected ->> 'id')::uuid;
  perform public.kc3_upsert_place_details(target_id, '{
    "expectedUpdatedAt":null,
    "details":{"seatingNotes":"KC3-reviewed seating","outlets":"unknown",
      "wifi":"unknown","workSuitability":"unknown","foodBeverage":"unknown",
      "phoneCallsAllowed":null,"bathroomAvailable":null,
      "driveThruAvailable":null,"driveThruOnly":null,
      "lastVerifiedAt":null,"verificationNotes":null}
  }'::jsonb);
  perform public.kc3_correct_canonical_place(target_id, jsonb_build_object(
    'expectedUpdatedAt', selected ->> 'placeUpdatedAt',
    'canonical', jsonb_build_object(
      'name','Fixture cafe corrected', 'address','1 Main St',
      'addressPrecision','street_address','placeType','cafe'),
    'evidence', jsonb_build_object(
      'sourceUrl','https://example.org/fixture-review',
      'observedOn','2026-10-02',
      'notes','Independent fixture evidence for corrected name.')));
end;
$$;

set local role anon;
select public.kc3_publication_gate_ready() as gate_ready \gset
select count(*)::integer as published_count from public.list_public_place_summaries() \gset
select count(*)::integer as legacy_list_count from public.list_public_places() \gset
select count(*)::integer as detail_count from public.get_public_place_detail(
  (select id from public.list_public_place_summaries())) \gset
select regular_hours_available as hours_available from public.get_public_place_detail(
  (select id from public.list_public_place_summaries())) \gset
select public.get_public_place_attribution(id)->>'source' as attribution_source
  from public.list_public_place_summaries() \gset
reset role;
select is(:'published_count'::integer, 1,
  'only the reviewed row is published');
select is(:'gate_ready'::boolean, true,
  'anonymous client can verify the publication migration is present');
select is(:'attribution_source'::text, 'Overture Maps',
  'anonymous detail attribution names the reviewed source');
select is((select field_provenance ->> 'timeZone'
  from public.place_publications limit 1), 'KC3 regional rule',
  'field-level provenance distinguishes KC3-derived timezone');
select is((select review_notes from public.place_publications limit 1),
  'Fixture municipality and duplicate review',
  'attended publication review notes are retained');
select is((select field_provenance ->> 'name'
  from public.place_publications limit 1), 'KC3 correction',
  'later canonical correction updates current field provenance');
select is((select details.seating_notes from public.place_details as details
  join public.place_publications as publication
    on publication.place_id = details.place_id limit 1),
  'KC3-reviewed seating', 'KC3 detail operator can edit a published place');
select is((select count(*)::integer from public.place_canonical_corrections), 1,
  'canonical correction operator records evidence on a published place');
select is(:'legacy_list_count'::integer, 1,
  'legacy five-field list also excludes unreviewed rows');
select is(:'detail_count'::integer, 1,
  'reviewed place is available through anonymous detail RPC');
select is(:'hours_available'::boolean, false,
  'missing independent hours remain unavailable');
select ok(not has_table_privilege('anon','public.place_publications','select'),
  'anonymous clients cannot read the provenance ledger directly');
select * from finish();
rollback;
