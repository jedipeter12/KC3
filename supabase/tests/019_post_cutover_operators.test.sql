begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

-- All identities below are synthetic. This transaction is rolled back even
-- when the suite runs against a populated local database.
insert into public.places (id, name, city, address, place_type, status)
values ('31000000-0000-4000-8000-000000000099',
  'Postcutover Operator Fixture', 'Lenexa', '99 Legacy St', 'cafe', 'active');

set local role service_role;
select public.kc3_stage_overture_review(jsonb_build_object(
  'schemaVersion', 1,
  'batchId', '31000000-0000-4000-8000-000000000000',
  'release', '2026-09-23.1',
  'manifestSha256', repeat('a', 64),
  'records', (select jsonb_agg(jsonb_build_object(
    'overtureId', '31000000-0000-4000-8000-' || lpad(number::text, 12, '0'),
    'targetPlaceId', null,
    'identity', jsonb_build_object(
      'name', 'Postcutover Operator Fixture', 'city', 'Lenexa',
      'address', number::text || ' Reviewed St', 'placeType', 'cafe',
      'status', case when number = 3 then 'hidden' else 'active' end,
      'addressPrecision', 'street_address', 'latitude', 38.9,
      'longitude', -94.7, 'timeZone', 'America/Chicago',
      'website', null, 'postcode', null),
    'identityEvidence', jsonb_build_object(
      'sourceUrl', 'https://example.org/synthetic-review',
      'observedOn', '2026-10-02', 'reuseBasis', 'Overture license',
      'notes', ''),
    'source', jsonb_build_object(
      'id', '31000000-0000-4000-8000-' || lpad(number::text, 12, '0'),
      'sources', jsonb_build_array(jsonb_build_object(
        'dataset', 'synthetic', 'license', 'CDLA-Permissive-2.0'))),
    'hours', null
  ) order by number) from generate_series(1, 3) as number)
));
select public.kc3_publish_overture_place(
  '31000000-0000-4000-8000-000000000000',
  ('31000000-0000-4000-8000-' || lpad(number::text, 12, '0'))::uuid,
  null, null, true, true, 'Synthetic municipality and duplicate review')
from generate_series(1, 3) as number;
reset role;

create temporary table operator_fixture_ids as
select overture_id, place_id from public.place_publications
where batch_id = '31000000-0000-4000-8000-000000000000';
insert into public.place_hours (place_id, day_of_week, open_time, close_time,
  source, source_observed_at)
select place_id, 1, '08:00', '17:00', 'kc3', '2026-10-02T12:00:00Z'
from operator_fixture_ids
where overture_id = '31000000-0000-4000-8000-000000000001';

select ok(has_function_privilege('service_role',
  'public.kc3_search_places_for_details(text,text)', 'execute')
  and has_function_privilege('service_role',
  'public.kc3_upsert_place_details(uuid,jsonb)', 'execute')
  and has_function_privilege('service_role',
  'public.kc3_search_places_for_canonical_correction(text,text)', 'execute')
  and has_function_privilege('service_role',
  'public.kc3_correct_canonical_place(uuid,jsonb)', 'execute'),
  'service role has the attended operator RPCs');
select ok(not has_function_privilege('anon',
  'public.kc3_upsert_place_details(uuid,jsonb)', 'execute')
  and not has_function_privilege('authenticated',
  'public.kc3_correct_canonical_place(uuid,jsonb)', 'execute'),
  'client roles cannot write through operator RPCs');
select is(jsonb_array_length(public.kc3_search_places_for_details(
  'postcutover operator', 'lenexa')), 2,
  'details search selects only active reviewed publications');
select is(jsonb_array_length(public.kc3_search_places_for_canonical_correction(
  'postcutover operator', 'Lenexa')), 2,
  'canonical search excludes unpublished legacy and hidden publications');
select is(public.kc3_search_places_for_details(
  'postcutover operator', 'Lenexa') #>> '{0,address}', '1 Reviewed St',
  'duplicate-looking reviewed places have deterministic address order');
select is(public.kc3_search_places_for_details(
  'postcutover operator', 'Lenexa') #>> '{0,overtureId}',
  '31000000-0000-4000-8000-000000000001',
  'details selection exposes the reviewed Overture identity');
select is(public.kc3_search_places_for_canonical_correction(
  'postcutover operator', 'Lenexa') #>> '{1,overtureId}',
  '31000000-0000-4000-8000-000000000002',
  'canonical selection exposes the reviewed Overture identity');
select is(jsonb_array_length(public.kc3_search_places_for_details(
  'postcutover operator', 'Olathe')), 0,
  'operators require the requested city');

select ok(not has_table_privilege('kc3_place_detail_operator',
  'public.places', 'update')
  and not has_table_privilege('kc3_place_detail_operator',
  'public.place_publications', 'update')
  and not has_table_privilege('kc3_place_detail_operator',
  'public.place_hours', 'insert, update, delete')
  and not has_table_privilege('kc3_place_detail_operator',
  'public.place_overrides', 'insert, update, delete')
  and has_column_privilege('kc3_place_detail_operator',
  'public.place_details', 'outlets', 'update'),
  'details owner can edit KC3 details but not identity, publication, or hours');
select ok(has_column_privilege('kc3_canonical_correction_operator',
  'public.places', 'name', 'update')
  and has_column_privilege('kc3_canonical_correction_operator',
  'public.place_publications', 'field_provenance', 'update')
  and not has_column_privilege('kc3_canonical_correction_operator',
  'public.places', 'city', 'update')
  and not has_column_privilege('kc3_canonical_correction_operator',
  'public.places', 'status', 'update')
  and not has_column_privilege('kc3_canonical_correction_operator',
  'public.places', 'latitude', 'update')
  and not has_column_privilege('kc3_canonical_correction_operator',
  'public.places', 'longitude', 'update')
  and not has_column_privilege('kc3_canonical_correction_operator',
  'public.places', 'time_zone', 'update')
  and not has_column_privilege('kc3_canonical_correction_operator',
  'public.places', 'google_place_id', 'update')
  and not has_column_privilege('kc3_canonical_correction_operator',
  'public.places', 'moved_to_place_id', 'update')
  and not has_column_privilege('kc3_canonical_correction_operator',
  'public.place_publications', 'source_record', 'update')
  and not has_table_privilege('kc3_canonical_correction_operator',
  'public.place_details', 'insert, update, delete')
  and not has_table_privilege('kc3_canonical_correction_operator',
  'public.place_hours', 'insert, update, delete')
  and not has_table_privilege('kc3_canonical_correction_operator',
  'public.place_overrides', 'insert, update, delete'),
  'correction owner has only canonical facts, provenance, and audit insert');
select ok(not has_table_privilege('kc3_canonical_correction_operator',
  'public.place_canonical_corrections', 'update, delete')
  and not has_table_privilege('service_role',
  'public.place_canonical_corrections', 'select, insert, update, delete'),
  'correction evidence cannot be changed or directly read by service role');

create temporary table operator_protected_before as
select (select to_jsonb(p) from public.places p where p.id = f.place_id) place_row,
  (select to_jsonb(pub) from public.place_publications pub
    where pub.place_id = f.place_id) publication_row,
  (select coalesce(jsonb_agg(to_jsonb(h) order by h.id), '[]'::jsonb)
    from public.place_hours h where h.place_id = f.place_id) hours_rows
from operator_fixture_ids f
where f.overture_id = '31000000-0000-4000-8000-000000000001';

select throws_ok(format(
  'select public.kc3_upsert_place_details(%L::uuid, %L::jsonb)',
  '31000000-0000-4000-8000-000000000099',
  '{"expectedUpdatedAt":null,"details":{"seatingNotes":null,"outlets":"unknown","wifi":"unknown","workSuitability":"unknown","foodBeverage":"unknown","phoneCallsAllowed":null,"bathroomAvailable":null,"driveThruAvailable":null,"driveThruOnly":null,"lastVerifiedAt":null,"verificationNotes":null}}'),
  'P0002', null, 'unpublished legacy place cannot receive detail edits');
select throws_ok(format(
  'select public.kc3_upsert_place_details(%L::uuid, %L::jsonb)',
  (select place_id from operator_fixture_ids where overture_id =
    '31000000-0000-4000-8000-000000000003'),
  '{"expectedUpdatedAt":null,"details":{}}'),
  '22023', null, 'incomplete detail payload is rejected before writing');
select throws_ok(format(
  'select public.kc3_upsert_place_details(%L::uuid, %L::jsonb)',
  (select place_id from operator_fixture_ids where overture_id =
    '31000000-0000-4000-8000-000000000003'),
  '{"expectedUpdatedAt":null,"details":{"seatingNotes":null,"outlets":"unknown","wifi":"unknown","workSuitability":"unknown","foodBeverage":"unknown","phoneCallsAllowed":null,"bathroomAvailable":null,"driveThruAvailable":null,"driveThruOnly":null,"lastVerifiedAt":null,"verificationNotes":null}}'),
  'P0002', null, 'hidden reviewed place cannot receive detail edits');

select lives_ok(format(
  'select public.kc3_upsert_place_details(%L::uuid, %L::jsonb)',
  (select place_id from operator_fixture_ids where overture_id =
    '31000000-0000-4000-8000-000000000001'),
  jsonb_build_object('expectedUpdatedAt', null, 'details', jsonb_build_object(
    'seatingNotes', 'Synthetic indoor tables', 'outlets', 'many',
    'wifi', 'unknown', 'workSuitability', 'unknown',
    'foodBeverage', 'unknown', 'phoneCallsAllowed', null,
    'bathroomAvailable', null, 'driveThruAvailable', true,
    'driveThruOnly', false, 'lastVerifiedAt', '2026-10-02',
    'verificationNotes', 'Synthetic observation'))::text),
  'complete reviewed detail snapshot can be created');
select ok((select outlets = 'many' and bathroom_available is null
  and drive_thru_available is true and drive_thru_only is false
  and last_verified_at = '2026-10-02'::date
  from public.place_details where place_id = (select place_id
    from operator_fixture_ids where overture_id =
      '31000000-0000-4000-8000-000000000001')),
  'unknown, drive-thru, and verification values persist exactly');
select ok((select to_jsonb(p) from public.places p where p.id =
  (select place_id from operator_fixture_ids where overture_id =
    '31000000-0000-4000-8000-000000000001')) =
    (select place_row from operator_protected_before)
  and (select to_jsonb(pub) from public.place_publications pub where pub.place_id =
    (select place_id from operator_fixture_ids where overture_id =
      '31000000-0000-4000-8000-000000000001')) =
    (select publication_row from operator_protected_before)
  and (select jsonb_agg(to_jsonb(h) order by h.id) from public.place_hours h
    where h.place_id = (select place_id from operator_fixture_ids where overture_id =
      '31000000-0000-4000-8000-000000000001')) =
    (select hours_rows from operator_protected_before),
  'detail edit leaves canonical identity, publication evidence, and hours unchanged');

-- The separate third-space operator owns these fields. A details edit must
-- preserve them even when it updates the same place_details row.
update public.place_details
set casual_hangout_suitable = true,
  supported_activities = array['board_games'::public.activity_type]
where place_id = (select place_id from operator_fixture_ids where overture_id =
  '31000000-0000-4000-8000-000000000001');
select lives_ok(format(
  'select public.kc3_upsert_place_details(%L::uuid, %L::jsonb)',
  (select place_id from operator_fixture_ids where overture_id =
    '31000000-0000-4000-8000-000000000001'),
  jsonb_build_object('expectedUpdatedAt', (select updated_at::text
      from public.place_details where place_id = (select place_id
        from operator_fixture_ids where overture_id =
          '31000000-0000-4000-8000-000000000001')),
    'details', jsonb_build_object(
      'seatingNotes', 'Synthetic updated tables', 'outlets', 'few',
      'wifi', 'public', 'workSuitability', 'unknown',
      'foodBeverage', 'unknown', 'phoneCallsAllowed', null,
      'bathroomAvailable', null, 'driveThruAvailable', true,
      'driveThruOnly', false, 'lastVerifiedAt', '2026-10-02',
      'verificationNotes', 'Synthetic recheck'))::text),
  'existing reviewed detail row can be updated with its current version');
select ok((select seating_notes = 'Synthetic updated tables'
  and outlets = 'few' and wifi = 'public'
  and verification_notes = 'Synthetic recheck'
  and casual_hangout_suitable is true
  and supported_activities = array['board_games'::public.activity_type]
  from public.place_details where place_id = (select place_id
    from operator_fixture_ids where overture_id =
      '31000000-0000-4000-8000-000000000001'))
  and (select to_jsonb(p) from public.places p where p.id =
    (select place_id from operator_fixture_ids where overture_id =
      '31000000-0000-4000-8000-000000000001')) =
    (select place_row from operator_protected_before)
  and (select to_jsonb(pub) from public.place_publications pub where pub.place_id =
    (select place_id from operator_fixture_ids where overture_id =
      '31000000-0000-4000-8000-000000000001')) =
    (select publication_row from operator_protected_before)
  and (select jsonb_agg(to_jsonb(h) order by h.id) from public.place_hours h
    where h.place_id = (select place_id from operator_fixture_ids where overture_id =
      '31000000-0000-4000-8000-000000000001')) =
    (select hours_rows from operator_protected_before),
  'detail update changes only KC3-owned values');

create temporary table detail_snapshot as
select to_jsonb(d) row_value from public.place_details d
where place_id = (select place_id from operator_fixture_ids where overture_id =
  '31000000-0000-4000-8000-000000000001');
select throws_ok(format(
  'select public.kc3_upsert_place_details(%L::uuid, %L::jsonb)',
  (select place_id from operator_fixture_ids where overture_id =
    '31000000-0000-4000-8000-000000000001'),
  jsonb_build_object('expectedUpdatedAt', '2000-01-01 00:00:00+00',
    'details', (select row_value from detail_snapshot))::text),
  '22023', null, 'database columns are not accepted as a detail payload');
select throws_ok(format(
  'select public.kc3_upsert_place_details(%L::uuid, %L::jsonb)',
  (select place_id from operator_fixture_ids where overture_id =
    '31000000-0000-4000-8000-000000000001'),
  jsonb_build_object('expectedUpdatedAt', '2000-01-01 00:00:00+00',
    'details', jsonb_build_object('seatingNotes', null, 'outlets', 'unknown',
      'wifi', 'unknown', 'workSuitability', 'unknown',
      'foodBeverage', 'unknown', 'phoneCallsAllowed', null,
      'bathroomAvailable', null, 'driveThruAvailable', null,
      'driveThruOnly', null, 'lastVerifiedAt', null,
      'verificationNotes', null))::text),
  '40001', null, 'stale detail selection cannot overwrite a newer row');
select is((select to_jsonb(d) from public.place_details d where place_id =
  (select place_id from operator_fixture_ids where overture_id =
    '31000000-0000-4000-8000-000000000001')),
  (select row_value from detail_snapshot),
  'failed detail writes leave the saved row unchanged');

-- A correction requires complete evidence and changes all three rows together:
-- canonical facts, immutable history, and current field provenance.
select throws_ok(format(
  'select public.kc3_correct_canonical_place(%L::uuid, %L::jsonb)',
  '31000000-0000-4000-8000-000000000099',
  jsonb_build_object('expectedUpdatedAt', now()::text,
    'canonical', jsonb_build_object('name', 'Changed', 'address', '99 Legacy St',
      'addressPrecision', 'street_address', 'placeType', 'cafe'),
    'evidence', jsonb_build_object('sourceUrl', 'https://example.org/fixture',
      'observedOn', '2026-10-02', 'notes', 'Synthetic evidence'))::text),
  'P0002', null, 'unpublished legacy place cannot be corrected');
select throws_ok(format(
  'select public.kc3_correct_canonical_place(%L::uuid, %L::jsonb)',
  (select place_id from operator_fixture_ids where overture_id =
    '31000000-0000-4000-8000-000000000003'),
  jsonb_build_object('expectedUpdatedAt', (select updated_at::text
      from public.places where id = (select place_id from operator_fixture_ids
        where overture_id = '31000000-0000-4000-8000-000000000003')),
    'canonical', jsonb_build_object('name', 'Changed', 'address', '3 Reviewed St',
      'addressPrecision', 'street_address', 'placeType', 'cafe'),
    'evidence', jsonb_build_object('sourceUrl', 'https://example.org/fixture',
      'observedOn', '2026-10-02', 'notes', 'Synthetic evidence'))::text),
  'P0002', null, 'hidden reviewed place cannot be corrected');
select throws_ok(format(
  'select public.kc3_correct_canonical_place(%L::uuid, %L::jsonb)',
  (select place_id from operator_fixture_ids where overture_id =
    '31000000-0000-4000-8000-000000000001'),
  jsonb_build_object('expectedUpdatedAt', '2000-01-01T00:00:00Z',
    'canonical', jsonb_build_object('name', 'Changed', 'address', '1 Reviewed St',
      'addressPrecision', 'street_address', 'placeType', 'cafe'),
    'evidence', jsonb_build_object('sourceUrl', 'https://example.org/fixture',
      'observedOn', '2026-10-02', 'notes', 'Synthetic evidence'))::text),
  '40001', null, 'stale canonical selection is rejected');
select throws_ok(format(
  'select public.kc3_correct_canonical_place(%L::uuid, %L::jsonb)',
  (select place_id from operator_fixture_ids where overture_id =
    '31000000-0000-4000-8000-000000000001'),
  jsonb_build_object('expectedUpdatedAt', (select updated_at::text
      from public.places where id = (select place_id from operator_fixture_ids
        where overture_id = '31000000-0000-4000-8000-000000000001')),
    'canonical', jsonb_build_object('name', 'Changed', 'address', '1 Reviewed St',
      'addressPrecision', 'street_address', 'placeType', 'cafe'),
    'evidence', jsonb_build_object('sourceUrl', 'http://example.org/fixture',
      'observedOn', '2026-10-02', 'notes', 'Synthetic evidence'))::text),
  '22023', null, 'non-HTTPS correction evidence is rejected');
select throws_ok(format(
  'select public.kc3_correct_canonical_place(%L::uuid, %L::jsonb)',
  (select place_id from operator_fixture_ids where overture_id =
    '31000000-0000-4000-8000-000000000001'),
  jsonb_build_object('expectedUpdatedAt', (select updated_at::text
      from public.places where id = (select place_id from operator_fixture_ids
        where overture_id = '31000000-0000-4000-8000-000000000001')),
    'canonical', jsonb_build_object('name', 'Changed', 'address', '1 Reviewed St',
      'addressPrecision', 'street_address', 'placeType', 'cafe'),
    'evidence', jsonb_build_object('sourceUrl', 'https://example.org/fixture',
      'observedOn', '2026-10-02', 'notes', ' '))::text),
  '22023', null, 'blank correction evidence notes are rejected');
select ok((select to_jsonb(p) from public.places p where p.id =
  (select place_id from operator_fixture_ids where overture_id =
    '31000000-0000-4000-8000-000000000001')) =
    (select place_row from operator_protected_before)
  and (select count(*) from public.place_canonical_corrections where place_id =
    (select place_id from operator_fixture_ids where overture_id =
      '31000000-0000-4000-8000-000000000001')) = 0,
  'rejected corrections preserve canonical facts and write no evidence');

select lives_ok(format(
  'select public.kc3_correct_canonical_place(%L::uuid, %L::jsonb)',
  (select place_id from operator_fixture_ids where overture_id =
    '31000000-0000-4000-8000-000000000001'),
  jsonb_build_object('expectedUpdatedAt', (select updated_at::text
      from public.places where id = (select place_id from operator_fixture_ids
        where overture_id = '31000000-0000-4000-8000-000000000001')),
    'canonical', jsonb_build_object('name', 'Postcutover Corrected Fixture',
      'address', '1 Reviewed St', 'addressPrecision', 'street_address',
      'placeType', 'cafe'),
    'evidence', jsonb_build_object('sourceUrl', 'https://example.org/fixture',
      'observedOn', '2026-10-02', 'notes', 'Synthetic source confirms name'))::text),
  'reviewed canonical correction commits with evidence');
select is((select count(*)::integer from public.place_canonical_corrections
  where place_id = (select place_id from operator_fixture_ids where overture_id =
    '31000000-0000-4000-8000-000000000001')), 1,
  'one correction creates exactly one evidence row');
select ok((select before_values = jsonb_build_object(
    'name', 'Postcutover Operator Fixture', 'address', '1 Reviewed St',
    'addressPrecision', 'street_address', 'placeType', 'cafe')
  and after_values = jsonb_build_object(
    'name', 'Postcutover Corrected Fixture', 'address', '1 Reviewed St',
    'addressPrecision', 'street_address', 'placeType', 'cafe')
  and source_url = 'https://example.org/fixture'
  and source_observed_on = '2026-10-02'::date
  and correction_notes = 'Synthetic source confirms name'
  from public.place_canonical_corrections where place_id =
    (select place_id from operator_fixture_ids where overture_id =
      '31000000-0000-4000-8000-000000000001')),
  'immutable evidence records exact before and after values and source');
select is((select field_provenance ->> 'name' from public.place_publications
  where place_id = (select place_id from operator_fixture_ids where overture_id =
    '31000000-0000-4000-8000-000000000001')), 'KC3 correction',
  'changed canonical field provenance moves to KC3 correction');
select is((select field_provenance ->> 'address' from public.place_publications
  where place_id = (select place_id from operator_fixture_ids where overture_id =
    '31000000-0000-4000-8000-000000000001')), 'Overture license',
  'unchanged field provenance keeps its published source');
select ok((select to_jsonb(d) from public.place_details d where place_id =
  (select place_id from operator_fixture_ids where overture_id =
    '31000000-0000-4000-8000-000000000001')) =
    (select row_value from detail_snapshot)
  and (select source_record from public.place_publications where place_id =
    (select place_id from operator_fixture_ids where overture_id =
      '31000000-0000-4000-8000-000000000001')) =
    (select publication_row -> 'source_record' from operator_protected_before)
  and (select jsonb_agg(to_jsonb(h) order by h.id) from public.place_hours h
    where h.place_id = (select place_id from operator_fixture_ids where overture_id =
      '31000000-0000-4000-8000-000000000001')) =
    (select hours_rows from operator_protected_before),
  'correction leaves KC3 details, source record, and hours untouched');

-- Force the audit insert to fail after the canonical UPDATE.
create function public.kc3_fixture_reject_correction()
returns trigger language plpgsql as $$
begin
  raise exception using errcode = 'P0001', message = 'synthetic audit failure';
end;
$$;
create trigger kc3_fixture_reject_correction
before insert on public.place_canonical_corrections
for each row execute function public.kc3_fixture_reject_correction();
create temporary table failed_correction_before as
select (select to_jsonb(p) from public.places p where p.id = f.place_id) place_row,
  (select to_jsonb(pub) from public.place_publications pub
    where pub.place_id = f.place_id) publication_row
from operator_fixture_ids f
where f.overture_id = '31000000-0000-4000-8000-000000000002';
select throws_ok(format(
  'select public.kc3_correct_canonical_place(%L::uuid, %L::jsonb)',
  (select place_id from operator_fixture_ids where overture_id =
    '31000000-0000-4000-8000-000000000002'),
  jsonb_build_object('expectedUpdatedAt', (select updated_at::text
      from public.places where id = (select place_id from operator_fixture_ids
        where overture_id = '31000000-0000-4000-8000-000000000002')),
    'canonical', jsonb_build_object('name', 'Should Roll Back',
      'address', '2 Reviewed St', 'addressPrecision', 'street_address',
      'placeType', 'cafe'),
    'evidence', jsonb_build_object('sourceUrl', 'https://example.org/fixture',
      'observedOn', '2026-10-02', 'notes', 'Synthetic failure'))::text),
  'P0001', 'synthetic audit failure',
  'audit insert failure aborts the entire canonical correction');
select ok((select to_jsonb(p) from public.places p where p.id =
  (select place_id from operator_fixture_ids where overture_id =
    '31000000-0000-4000-8000-000000000002')) =
    (select place_row from failed_correction_before)
  and (select to_jsonb(pub) from public.place_publications pub where pub.place_id =
    (select place_id from operator_fixture_ids where overture_id =
      '31000000-0000-4000-8000-000000000002')) =
    (select publication_row from failed_correction_before)
  and not exists (select 1 from public.place_canonical_corrections where place_id =
    (select place_id from operator_fixture_ids where overture_id =
      '31000000-0000-4000-8000-000000000002')),
  'failed evidence insert leaves facts, provenance, and history unchanged');

-- A later failure, at the provenance UPDATE, must also roll back the already
-- inserted audit row and the canonical UPDATE.
drop trigger kc3_fixture_reject_correction on public.place_canonical_corrections;
create function public.kc3_fixture_reject_provenance()
returns trigger language plpgsql as $$
begin
  raise exception using errcode = 'P0001', message = 'synthetic provenance failure';
end;
$$;
create trigger kc3_fixture_reject_provenance
before update of field_provenance on public.place_publications
for each row execute function public.kc3_fixture_reject_provenance();
select throws_ok(format(
  'select public.kc3_correct_canonical_place(%L::uuid, %L::jsonb)',
  (select place_id from operator_fixture_ids where overture_id =
    '31000000-0000-4000-8000-000000000002'),
  jsonb_build_object('expectedUpdatedAt', (select updated_at::text
      from public.places where id = (select place_id from operator_fixture_ids
        where overture_id = '31000000-0000-4000-8000-000000000002')),
    'canonical', jsonb_build_object('name', 'Should Roll Back',
      'address', '2 Reviewed St', 'addressPrecision', 'street_address',
      'placeType', 'cafe'),
    'evidence', jsonb_build_object('sourceUrl', 'https://example.org/fixture',
      'observedOn', '2026-10-02', 'notes', 'Synthetic failure'))::text),
  'P0001', 'synthetic provenance failure',
  'provenance failure aborts canonical facts and already inserted evidence');
select ok((select to_jsonb(p) from public.places p where p.id =
  (select place_id from operator_fixture_ids where overture_id =
    '31000000-0000-4000-8000-000000000002')) =
    (select place_row from failed_correction_before)
  and (select to_jsonb(pub) from public.place_publications pub where pub.place_id =
    (select place_id from operator_fixture_ids where overture_id =
      '31000000-0000-4000-8000-000000000002')) =
    (select publication_row from failed_correction_before)
  and not exists (select 1 from public.place_canonical_corrections where place_id =
    (select place_id from operator_fixture_ids where overture_id =
      '31000000-0000-4000-8000-000000000002')),
  'failed provenance update leaves facts, provenance, and history unchanged');

select * from finish();
rollback;
