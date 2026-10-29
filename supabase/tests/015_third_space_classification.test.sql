begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(24);

insert into public.places (id, name, city, address, place_type, mvp_published)
values ('f0000000-0000-0000-0000-000000000001', 'Evening Bookstore',
  'Olathe', '1 Main St', 'bookstore', true);
select is((select count(*)::integer from public.list_public_places()
  where id = 'f0000000-0000-0000-0000-000000000001'), 1,
  'explicitly curated bootstrap records keep the legacy public contract');

insert into public.place_details (place_id, work_suitability)
values ('f0000000-0000-0000-0000-000000000001', 'good');
select ok((select casual_hangout_suitable is null
  and social_community_suitable is null and supported_activities is null
  and organized_activities is null and free_public_access is null
  from public.place_details where place_id = 'f0000000-0000-0000-0000-000000000001'),
  'added classifications on old records remain unknown');
update public.place_details set casual_hangout_suitable = false,
  social_community_suitable = true, quiet_independent_activity = true,
  casual_conversation = true, group_gatherings = false,
  meet_new_people = true,
  supported_activities = array['board_games', 'workshop']::public.activity_type[],
  organized_activities = array['workshop']::public.activity_type[],
  free_public_access = true, purchase_expected = false,
  paid_admission = false, activity_fees = true
where place_id = 'f0000000-0000-0000-0000-000000000001';
select ok((select work_suitability = 'good' and casual_hangout_suitable is false
  and social_community_suitable is true from public.place_details
  where place_id = 'f0000000-0000-0000-0000-000000000001'),
  'work, casual, and social suitability vary independently');
select ok((select supported_activities @> array['board_games']::public.activity_type[]
  and organized_activities @> array['workshop']::public.activity_type[]
  and not organized_activities @> array['board_games']::public.activity_type[]
  from public.place_details where place_id = 'f0000000-0000-0000-0000-000000000001'),
  'supported activities differ from organized activities');
select ok((select free_public_access is true and activity_fees is true
  from public.place_details where place_id = 'f0000000-0000-0000-0000-000000000001'),
  'financial access attributes are not mutually exclusive');

insert into public.places (id, name, city, address, place_type)
values ('f0000000-0000-0000-0000-000000000002', 'Daytime Hobby Space',
  'Lenexa', '2 Main St', 'hobby_space');
insert into public.place_discoveries (place_id, source, verification_notes)
values ('f0000000-0000-0000-0000-000000000002', 'manual_research',
  'Private lead, not a provider fact');
select is((select verification_state::text from public.place_discoveries
  where place_id = 'f0000000-0000-0000-0000-000000000002'),
  'discovered', 'new intake starts discovered');
select is((select count(*)::integer from public.list_public_places()
  where id = 'f0000000-0000-0000-0000-000000000002'), 0,
  'candidate is hidden from the legacy public list');
select is((select count(*)::integer from public.list_public_place_summaries()
  where id = 'f0000000-0000-0000-0000-000000000002'), 0,
  'candidate is hidden from public summaries');
select is((select count(*)::integer from public.get_public_place_detail(
  'f0000000-0000-0000-0000-000000000002')), 0,
  'candidate is hidden from public detail');
select throws_ok($$ update public.place_discoveries set verification_state = 'verified'
  where place_id = 'f0000000-0000-0000-0000-000000000002' $$,
  '23514', null, 'verified requires an explicit review checklist');
select throws_ok($$ update public.place_discoveries set mvp_eligible = true
  where place_id = 'f0000000-0000-0000-0000-000000000002' $$,
  '23514', null, 'MVP eligibility requires a verified third space');
insert into public.place_discoveries (lead_name, lead_city, source)
values ('Recommended Board Games', 'Olathe', 'reddit');
select ok((select place_id is null and verification_state = 'discovered'
  and mvp_eligible is null from public.place_discoveries
  where lead_name = 'Recommended Board Games'),
  'a Reddit recommendation remains an unlinked, unverified lead');
select ok(not has_table_privilege('anon', 'public.place_discoveries', 'select'),
  'anonymous clients cannot read private discovery leads');
select ok(not has_table_privilege('service_role', 'public.place_discoveries', 'update'),
  'service role cannot directly approve a discovery');
update public.place_discoveries set verification_state = 'verified',
  business_exists = true, currently_operating = true, publicly_accessible = true,
  hours_reviewed = true, amenities_reviewed = true, suitability_reviewed = true,
  is_third_space = true, last_verified_at = current_date, mvp_eligible = false
where place_id = 'f0000000-0000-0000-0000-000000000002';
select ok((select verification_state = 'verified' and is_third_space is true
  and mvp_eligible is false from public.place_discoveries
  where place_id = 'f0000000-0000-0000-0000-000000000002'),
  'verified third spaces may be future candidates');
select throws_ok($$ update public.places set mvp_published = true
  where id = 'f0000000-0000-0000-0000-000000000002' $$,
  '23514', 'MVP publication requires a verified eligible discovery',
  'ineligible candidates cannot be published');
select throws_ok($$ update public.place_discoveries set mvp_eligible = true
  where place_id = 'f0000000-0000-0000-0000-000000000002' $$,
  '23514', 'MVP eligibility requires an active target-city place open through 8 p.m.',
  'MVP eligibility itself requires an 8 p.m. interval');
insert into public.place_hours (place_id, day_of_week, open_time, close_time,
  source, is_closed) values (
  'f0000000-0000-0000-0000-000000000002', 1, '10:00', '20:00', 'kc3', false);
update public.place_hours_eligibility_reviews
set reviewed_revision = hours_revision
where place_id = 'f0000000-0000-0000-0000-000000000002';
update public.place_discoveries set mvp_eligible = true
where place_id = 'f0000000-0000-0000-0000-000000000002';
update public.places set mvp_published = true
where id = 'f0000000-0000-0000-0000-000000000002';
select is((select count(*)::integer from public.list_public_places()
  where id = 'f0000000-0000-0000-0000-000000000002'), 1,
  'an explicitly published verified evening place becomes public');
update public.place_discoveries set mvp_eligible = false
where place_id = 'f0000000-0000-0000-0000-000000000002';
select is((select count(*)::integer from public.list_public_places()
  where id = 'f0000000-0000-0000-0000-000000000002'), 0,
  'revoking eligibility unpublishes the place');

select lives_ok($sql$ select public.kc3_import_google_place(jsonb_build_object(
  'googlePlaceId', 'third-space-import-test', 'placeType', 'community_center',
  'fetchedAt', '2026-10-28T12:00:00Z',
  'provider', jsonb_build_object('name', 'Imported Community Center'),
  'canonical', jsonb_build_object('name', 'Imported Community Center',
    'city', 'Olathe', 'address', '3 Main St', 'latitude', 38.9,
    'longitude', -94.8, 'timeZone', 'America/Chicago',
    'status', 'active'))) $sql$,
  'Google ingestion accepts an expanded category');
select ok((select not mvp_published from public.places
  where google_place_id = 'third-space-import-test'),
  'new Google discovery remains private');
select ok((select source = 'google_places' and verification_state = 'discovered'
  and mvp_eligible is null from public.place_discoveries
  where place_id = (select id from public.places
    where google_place_id = 'third-space-import-test')),
  'Google intake retains provenance without asserting verified facts');
insert into public.place_details (place_id, casual_hangout_suitable,
  social_community_suitable, supported_activities)
select id, true, true, array['community_gathering']::public.activity_type[]
from public.places where google_place_id = 'third-space-import-test';
select lives_ok($sql$ select public.kc3_import_google_place(jsonb_build_object(
  'googlePlaceId', 'third-space-import-test', 'placeType', 'community_center',
  'fetchedAt', '2026-10-28T13:00:00Z',
  'provider', jsonb_build_object('rating', 4.5),
  'canonical', '{}'::jsonb)) $sql$,
  'Google refresh succeeds without updating KC3 fields');
select ok((select details.casual_hangout_suitable is true
  and details.social_community_suitable is true
  and details.supported_activities @> array['community_gathering']::public.activity_type[]
  and not places.mvp_published
  from public.place_details as details join public.places as places
    on places.id = details.place_id
  where places.google_place_id = 'third-space-import-test'),
  'Google refresh preserves KC3 classification and publication state');

select * from finish();
rollback;
