-- Read-only post-migration / post-restore gate. Run against each target before
-- reconnecting clients. Any nonzero published Google count or enabled legacy
-- importer is a stop condition. This does not assert hosted backup deletion.
begin transaction isolation level repeatable read read only;

select
  count(*) filter (where places.status = 'active') as published_active,
  count(*) filter (where places.google_place_id is not null) as published_google_ids,
  count(*) filter (where google.place_id is not null) as published_google_rows,
  count(*) filter (where hours.place_id is not null) as published_google_hours_places
from public.place_publications as publication
join public.places as places on places.id = publication.place_id
left join public.place_google_data as google on google.place_id = places.id
left join (select distinct place_id from public.place_hours where source = 'google')
  as hours on hours.place_id = places.id;

select
  (select count(*) from public.places) as all_legacy_and_published_places,
  (select count(*) from public.place_publications) as reviewed_publications,
  (select count(*) from public.place_google_data) as remaining_private_google_rows,
  (select count(*) from public.place_hours where source = 'google')
    as remaining_private_google_hours,
  (select count(*) from public.place_canonical_corrections)
    as correction_history_rows_requiring_disposition;

select
  has_function_privilege('anon',
    'public.kc3_publication_gate_ready()', 'execute') as client_gate_available,
  has_function_privilege('service_role',
    'public.kc3_import_google_place(jsonb)', 'execute') as old_import_executable,
  has_function_privilege('service_role',
    'public.kc3_reconcile_google_place(jsonb)', 'execute')
    as old_reconciliation_executable,
  has_function_privilege('service_role',
    'public.kc3_google_import_state()', 'execute') as old_state_executable;

select tgname, tgenabled from pg_trigger
where tgrelid in ('public.places'::regclass,
  'public.place_google_data'::regclass, 'public.place_hours'::regclass)
  and tgname in ('reject_google_place_id','reject_google_provider_copy',
    'reject_google_hours') order by tgname;

rollback;
