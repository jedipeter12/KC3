begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(33);
grant kc3_third_space_operator to postgres;
grant anon to postgres;
grant service_role to postgres;
grant usage on schema extensions to kc3_third_space_operator;
grant usage on schema extensions to anon;
grant usage on schema extensions to service_role;
grant execute on function public.kc3_hours_review_pending(uuid) to kc3_third_space_operator;

create function pg_temp.review_payload(target_id uuid, review_changes jsonb default '{}'::jsonb,
  class_changes jsonb default '{}'::jsonb, publish boolean default false,
  review_hours boolean default false) returns jsonb language sql as $$
  select jsonb_build_object(
    'expectedUpdatedAt', row->'updatedAt',
    'expectedPlaceUpdatedAt', row->'place'->'updatedAt',
    'expectedDetailUpdatedAt', row->'detailUpdatedAt',
    'expectedHoursRevision', row->'hoursRevision',
    'expectedEffectiveOverrideId', row->'effectiveOverrideId',
    'review', row->'review' || review_changes,
    'classification', case when row->'classification' = 'null'::jsonb then 'null'::jsonb
      else row->'classification' || class_changes end,
    'published', case when row->'place' = 'null'::jsonb then 'null'::jsonb else to_jsonb(publish) end,
    'reviewHours', to_jsonb(review_hours))
  from (select public.kc3_third_space_review_json(target_id) row) snapshot;
$$;
grant execute on function pg_temp.review_payload(uuid,jsonb,jsonb,boolean,boolean)
  to kc3_third_space_operator;

insert into public.places(id,name,city,address,place_type,time_zone)
values ('f1000000-0000-0000-0000-000000000001','Board Game Hall','Lenexa','1 Main St','board_game_cafe','America/Chicago');
insert into public.places(id,name,city,address,place_type,mvp_published)
values ('f1000000-0000-0000-0000-000000000002','Legacy Seed','Olathe','2 Main St','library',true);
insert into public.place_discoveries(id,place_id,source,discovered_at,verification_state,
  business_exists,verification_notes)
values ('f2000000-0000-0000-0000-000000000001',
  'f1000000-0000-0000-0000-000000000001','reddit','2026-10-20','in_review',false,'Lead only');
set local role kc3_third_space_operator;
select is((public.kc3_third_space_review_json('f2000000-0000-0000-0000-000000000001')->>'source'),
  'reddit', 'source provenance is visible');
select ok((public.kc3_third_space_review_json('f2000000-0000-0000-0000-000000000001')->'review'->'businessExists') = 'false'::jsonb
  and (public.kc3_third_space_review_json('f2000000-0000-0000-0000-000000000001')->'review'->'currentlyOperating') = 'null'::jsonb,
  'verified no differs from unknown');
select is(jsonb_array_length(public.kc3_search_third_space_reviews('Board Game','Lenexa','reddit')),1,
  'source-agnostic search finds linked discovery');
select is(jsonb_array_length(public.kc3_search_third_space_reviews('Board Game','Lenexa','google_places')),0,
  'source filter does not conflate provenance');
reset role;
set local role service_role;
select is(jsonb_array_length(public.kc3_search_third_space_reviews('Board Game','Lenexa','reddit')),1,
  'service role can execute the constrained search RPC');
reset role;
set local role kc3_third_space_operator;
select ok((public.kc3_get_unreviewed_third_space_place('f1000000-0000-0000-0000-000000000002')->>'name') = 'Legacy Seed',
  'operator can inspect a canonical place without an intake row');
select lives_ok($sql$select public.kc3_start_third_space_review(
  'f1000000-0000-0000-0000-000000000002','overture','2026-10-21',
  (select updated_at::text from public.places where id='f1000000-0000-0000-0000-000000000002'))$sql$,
  'operator can create a private review with explicit provenance');
select ok((select source='overture' and discovered_at='2026-10-21' and
  verification_state='discovered' and is_third_space is null and mvp_eligible is null
  from public.place_discoveries where place_id='f1000000-0000-0000-0000-000000000002'),
  'review start asserts no verification or eligibility');
select lives_ok($sql$select public.kc3_save_third_space_review(
  (select id from public.place_discoveries
    where place_id='f1000000-0000-0000-0000-000000000002'),
  pg_temp.review_payload((select id from public.place_discoveries
    where place_id='f1000000-0000-0000-0000-000000000002'),
    '{}'::jsonb,jsonb_build_object('socialCommunitySuitable',false),true,false))$sql$,
  'classification-only review saves on a grandfathered published place');
select ok((select mvp_published from public.places
  where id='f1000000-0000-0000-0000-000000000002') and
  (select social_community_suitable is false from public.place_details
  where place_id='f1000000-0000-0000-0000-000000000002'),
  'classification edit preserves grandfathered publication and verified no');
select ok(not has_function_privilege('anon','public.kc3_search_third_space_reviews(text,text,text)','execute')
  and not has_function_privilege('authenticated','public.kc3_save_third_space_review(uuid,jsonb)','execute'),
  'operator RPCs are server-only');
select ok(not has_table_privilege('service_role','public.place_discoveries','update')
  and not has_table_privilege('service_role','public.place_details','update'),
  'service role cannot bypass the review RPC with direct table updates');
select ok(not has_column_privilege('kc3_google_importer','public.places','mvp_published','update')
  and not has_column_privilege('kc3_google_importer','public.places','mvp_published','insert'),
  'provider importer cannot write the KC3 publication field');

reset role;
insert into public.place_hours(place_id,day_of_week,open_time,close_time,is_closed,source,source_observed_at)
values ('f1000000-0000-0000-0000-000000000001',5,'12:00','21:00',false,'kc3',now());
set local role kc3_third_space_operator;
select ok(public.kc3_hours_review_pending('f1000000-0000-0000-0000-000000000001'),
  'new hours require an eligibility review');
select throws_ok($sql$select public.kc3_save_third_space_review(
  'f2000000-0000-0000-0000-000000000001',
  pg_temp.review_payload('f2000000-0000-0000-0000-000000000001',
    jsonb_build_object('businessExists',true,'currentlyOperating',true,'publiclyAccessible',true,
      'hoursReviewed',true,'amenitiesReviewed',true,'suitabilityReviewed',true,
      'isThirdSpace',true,'lastVerifiedAt',current_date,'verificationState','verified',
      'mvpEligible',true),
    jsonb_build_object('casualHangoutSuitable',false,'supportedActivities','[]'::jsonb),
    true,false))$sql$, '23514', 'hours change requires eligibility review before publication',
  'pending hours cannot be published without completing review');
select lives_ok($sql$select public.kc3_save_third_space_review(
  'f2000000-0000-0000-0000-000000000001',
  pg_temp.review_payload('f2000000-0000-0000-0000-000000000001',
    jsonb_build_object('businessExists',true,'currentlyOperating',true,'publiclyAccessible',true,
      'hoursReviewed',true,'amenitiesReviewed',true,'suitabilityReviewed',true,
      'isThirdSpace',true,'lastVerifiedAt',current_date,'verificationState','verified',
      'mvpEligible',true),
    jsonb_build_object('casualHangoutSuitable',false,'supportedActivities','[]'::jsonb),
    true,true))$sql$, 'reviewed evening place can be published');
select ok((select casual_hangout_suitable is false and social_community_suitable is null
  and supported_activities = '{}'::public.activity_type[] and organized_activities is null
  from public.place_details where place_id='f1000000-0000-0000-0000-000000000001'),
  'classification keeps false, unknown, confirmed none, and unknown array distinct');
select ok(not public.kc3_hours_review_pending('f1000000-0000-0000-0000-000000000001'),
  'completed review clears only the observed hours revision');
reset role;
set local role anon;
select is((select count(*)::integer from public.list_public_places()
  where id='f1000000-0000-0000-0000-000000000001'),1,
  'published reviewed place is visible');
reset role;
set local role kc3_third_space_operator;

create temp table stale_payload as select pg_temp.review_payload(
  'f2000000-0000-0000-0000-000000000001') as payload;
reset role;
update public.place_discoveries set verification_notes='Fresh observation'
where id='f2000000-0000-0000-0000-000000000001';
set local role kc3_third_space_operator;
select throws_ok($sql$select public.kc3_save_third_space_review(
  'f2000000-0000-0000-0000-000000000001',(select payload from stale_payload))$sql$,
  '40001','discovery changed after selection','stale discovery edit is rejected');

reset role;
update public.place_hours set close_time='19:00'
where place_id='f1000000-0000-0000-0000-000000000001';
set local role kc3_third_space_operator;
select ok(public.kc3_hours_review_pending('f1000000-0000-0000-0000-000000000001'),
  'changed hours create a new pending revision');
reset role;
set local role anon;
select is((select count(*)::integer from public.list_public_places()
  where id='f1000000-0000-0000-0000-000000000001'),0,
  'pending hours review hides previously published place');
reset role;
set local role kc3_third_space_operator;
select throws_ok($sql$select public.kc3_save_third_space_review(
  'f2000000-0000-0000-0000-000000000001',
  pg_temp.review_payload('f2000000-0000-0000-0000-000000000001',
    '{}'::jsonb,'{}'::jsonb,true,true))$sql$,
  '23514',null,'review cannot retain publication without current 8 p.m. hours');
select lives_ok($sql$select public.kc3_save_third_space_review(
  'f2000000-0000-0000-0000-000000000001',
  pg_temp.review_payload('f2000000-0000-0000-0000-000000000001',
    jsonb_build_object('mvpEligible',false), '{}'::jsonb,false,true))$sql$,
  'operator can mark ineligible and unpublish after hours loss');
select ok((select not mvp_published from public.places
  where id='f1000000-0000-0000-0000-000000000001'),
  'publication decision records an explicit false after review');
select ok((select source='reddit' and mvp_eligible is false from public.place_discoveries
  where id='f2000000-0000-0000-0000-000000000001'),
  'hours review keeps discovery provenance and changes only KC3 eligibility');

create temp table stale_hours_payload as select pg_temp.review_payload(
  'f2000000-0000-0000-0000-000000000001') as payload;
reset role;
insert into public.place_hours(place_id,day_of_week,open_time,close_time,is_closed,
  source,source_observed_at) values
  ('f1000000-0000-0000-0000-000000000001',6,'12:00','21:00',false,'google',now());
set local role kc3_third_space_operator;
select ok((select casual_hangout_suitable is false and supported_activities='{}'::public.activity_type[]
  from public.place_details where place_id='f1000000-0000-0000-0000-000000000001'),
  'provider hours write preserves KC3 classifications');
select ok((select mvp_published is false from public.places
  where id='f1000000-0000-0000-0000-000000000001') and
  public.kc3_hours_review_pending('f1000000-0000-0000-0000-000000000001'),
  'provider hours write only marks review; it does not decide publication');
select throws_ok($sql$select public.kc3_save_third_space_review(
  'f2000000-0000-0000-0000-000000000001',(select payload from stale_hours_payload))$sql$,
  '40001','hours changed after selection','stale hours revision blocks review save');

create temp table prior_override_revision as select hours_revision
  from public.place_hours_eligibility_reviews
  where place_id='f1000000-0000-0000-0000-000000000001';
reset role;
insert into public.place_overrides(place_id,override_type,effective_start_date,
  override_value,source_observed_at) values (
  'f1000000-0000-0000-0000-000000000001','regular_hours.v1',
  (now() at time zone 'America/Chicago')::date,
  jsonb_build_object('version',1,'rows',(select jsonb_agg(jsonb_build_object(
    'dayOfWeek',day_number,'openTime',null,'closeTime',null,'isClosed',true,
    'closesNextDay',false) order by day_number)
    from generate_series(0,6) days(day_number))),now());
set local role kc3_third_space_operator;
select ok((select hours_revision > (select hours_revision from prior_override_revision)
  from public.place_hours_eligibility_reviews
  where place_id='f1000000-0000-0000-0000-000000000001'),
  'regular-hours override change creates a new review revision');
select ok(not public.kc3_has_eight_pm_schedule('f1000000-0000-0000-0000-000000000001'),
  'eligibility uses effective closed override rather than an open provider row');
select ok((select jsonb_array_length(row->'effectiveHours')=7
  and row->'effectiveHours'->0->>'source'='override'
  from (select public.kc3_third_space_review_json(
    'f2000000-0000-0000-0000-000000000001') row) snapshot),
  'operator sees the effective override and its provenance');
reset role;
update public.place_hours_eligibility_reviews set
  reviewed_revision=hours_revision, reviewed_effective_override_id=null
where place_id='f1000000-0000-0000-0000-000000000001';
set local role kc3_third_space_operator;
select ok(public.kc3_hours_review_pending('f1000000-0000-0000-0000-000000000001'),
  'active override identity reopens review even after a prior revision was cleared');

select * from finish();
rollback;
