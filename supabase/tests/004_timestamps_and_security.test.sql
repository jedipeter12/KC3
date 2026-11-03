begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(8);

insert into public.places (id,name,city,address,place_type,updated_at)
values ('50000000-0000-0000-0000-000000000001','Timestamp fixture',
  'Lenexa','50 Main St','park','2000-01-01 00:00:00+00');
insert into public.place_details (place_id,updated_at)
values ('50000000-0000-0000-0000-000000000001','2000-01-01 00:00:00+00');
insert into public.place_hours (place_id,day_of_week,open_time,close_time,
  source,source_observed_at,updated_at)
values ('50000000-0000-0000-0000-000000000001',1,'08:00','16:00',
  'kc3',now(),'2000-01-01 00:00:00+00');
update public.places set name=name
  where id='50000000-0000-0000-0000-000000000001';
update public.place_details set seating_notes='KC3 note'
  where place_id='50000000-0000-0000-0000-000000000001';
update public.place_hours set close_time='17:00'
  where place_id='50000000-0000-0000-0000-000000000001';

select ok((select updated_at>'2000-01-01' from public.places
  where id='50000000-0000-0000-0000-000000000001'),
  'canonical updates retain an audit timestamp');
select ok((select updated_at>'2000-01-01' from public.place_details
  where place_id='50000000-0000-0000-0000-000000000001'),
  'KC3 detail updates retain an audit timestamp');
select ok((select updated_at>'2000-01-01' from public.place_hours
  where place_id='50000000-0000-0000-0000-000000000001'),
  'KC3 hours updates retain an audit timestamp');
select is((select count(*)::integer from pg_class join pg_namespace
  on pg_namespace.oid=pg_class.relnamespace
  where nspname='public' and relname in ('places','place_details',
    'place_hours','place_publications','overture_review_batches')
    and relrowsecurity),5,
  'canonical, KC3, staging, and publication tables enforce RLS');
select ok(not has_table_privilege('anon','public.places','select')
  and not has_table_privilege('anon','public.place_publications','select'),
  'anonymous clients cannot read base identity or provenance tables');
select ok(not has_table_privilege('service_role','public.place_publications','insert'),
  'service role cannot bypass the publication RPC with a direct insert');
select is((select count(*)::integer from pg_trigger
  where tgname in ('reject_google_place_id','reject_google_provider_copy',
    'reject_google_hours') and tgenabled='O'),3,
  'all three Google-content resurrection guards are enabled');
select is((select pg_get_userbyid(proowner) from pg_proc
  where oid='public.kc3_publish_overture_place(uuid,uuid,uuid,timestamptz,boolean,boolean,text)'::regprocedure),
  'kc3_overture_publisher',
  'publication RPC is owned by its constrained role');
select * from finish();
rollback;
