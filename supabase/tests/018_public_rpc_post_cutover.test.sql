begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(32);

create function pg_temp.reviewed_record(
  external_id uuid, label text, kind text, lifecycle text, hours jsonb
) returns jsonb language sql as $$
  select jsonb_build_object(
    'overtureId', external_id, 'targetPlaceId', null,
    'identity', jsonb_build_object(
      'name', label, 'city', 'Lenexa', 'address', '1 Fixture Way',
      'placeType', kind, 'status', lifecycle,
      'addressPrecision', 'street_address', 'latitude', 38.9,
      'longitude', -94.7, 'timeZone', 'America/Chicago',
      'website', null, 'postcode', null),
    'identityEvidence', jsonb_build_object(
      'sourceUrl', 'https://example.org/fixture-identity',
      'observedOn', current_date, 'reuseBasis', 'Overture license', 'notes', ''),
    'source', jsonb_build_object('id', external_id, 'name', label,
      'sources', jsonb_build_array(jsonb_build_object(
        'dataset', 'fixture', 'license', 'CDLA-Permissive-2.0'))),
    'hours', hours);
$$;
create function pg_temp.weekly_hours(observed_on date) returns jsonb language sql as $$
  select jsonb_build_object(
    'sourceUrl', 'https://example.org/fixture-hours',
    'observedOn', observed_on, 'reuseBasis', 'Permitted source',
    'notes', 'Independent fixture hours', 'ruleType', 'weekly',
    'periods', (select jsonb_agg(jsonb_build_object(
      'dayOfWeek', day_number, 'openTime', '08:00', 'closeTime', '21:00',
      'isClosed', false, 'closesNextDay', false))
      from generate_series(0, 6) as days(day_number)));
$$;
create function pg_temp.dawn_hours() returns jsonb language sql as $$
  select jsonb_build_object(
    'sourceUrl', 'https://example.org/fixture-park-policy',
    'observedOn', current_date, 'reuseBasis', 'Permitted source',
    'notes', 'Independent dawn-to-dusk park policy', 'ruleType', 'dawn_to_dusk',
    'periods', (select jsonb_agg(jsonb_build_object(
      'dayOfWeek', day_number, 'openTime', null, 'closeTime', null,
      'isClosed', true, 'closesNextDay', false))
      from generate_series(0, 6) as days(day_number)));
$$;

insert into public.places (id, name, city, address, place_type)
values ('18000000-0000-0000-0000-000000000099',
  'Google sentinel unreviewed', 'Lenexa', '9 Fixture Way', 'cafe');

select public.kc3_stage_overture_review(jsonb_build_object(
  'schemaVersion', 1,
  'batchId', '18000000-0000-0000-0000-000000000001',
  'release', '2026-09-23.1', 'manifestSha256', repeat('a', 64),
  'records', jsonb_build_array(
    pg_temp.reviewed_record('18000000-0000-0000-0000-000000000011',
      'Unknown fixture', 'cafe', 'active', null),
    pg_temp.reviewed_record('18000000-0000-0000-0000-000000000012',
      'Fresh fixture', 'cafe', 'active', pg_temp.weekly_hours(current_date)),
    pg_temp.reviewed_record('18000000-0000-0000-0000-000000000013',
      'Stale fixture', 'cafe', 'active', pg_temp.weekly_hours(current_date - 15)),
    pg_temp.reviewed_record('18000000-0000-0000-0000-000000000014',
      'Dawn fixture', 'park', 'active', pg_temp.dawn_hours()),
    pg_temp.reviewed_record('18000000-0000-0000-0000-000000000015',
      'Hidden fixture', 'cafe', 'hidden', null))));
set local role service_role;
select public.kc3_publish_overture_place(
  '18000000-0000-0000-0000-000000000001', external_id,
  null, null, true, true, 'Disposable municipality and duplicate review')
from (values
  ('18000000-0000-0000-0000-000000000011'::uuid),
  ('18000000-0000-0000-0000-000000000012'::uuid),
  ('18000000-0000-0000-0000-000000000013'::uuid),
  ('18000000-0000-0000-0000-000000000014'::uuid),
  ('18000000-0000-0000-0000-000000000015'::uuid)
) as fixture(external_id);
reset role;

-- Current main also requires verified third-space and eight-p.m. eligibility.
-- Unknown hours and dawn-only park policy intentionally remain private.
update public.place_hours_eligibility_reviews
set reviewed_revision = hours_revision
where place_id in (select place_id from public.place_publications where overture_id in (
  '18000000-0000-0000-0000-000000000012',
  '18000000-0000-0000-0000-000000000013'));
insert into public.place_discoveries (
  place_id, source, verification_state, business_exists, currently_operating,
  publicly_accessible, hours_reviewed, amenities_reviewed,
  suitability_reviewed, is_third_space, last_verified_at, mvp_eligible
)
select place_id, 'overture', 'verified', true, true, true, true, true,
  true, true, current_date, true
from public.place_publications where overture_id in (
  '18000000-0000-0000-0000-000000000012',
  '18000000-0000-0000-0000-000000000013');
update public.places set mvp_published = true
where id in (select place_id from public.place_publications where overture_id in (
  '18000000-0000-0000-0000-000000000012',
  '18000000-0000-0000-0000-000000000013'));

select is((select count(*)::integer from public.list_public_places()
  where name like '%fixture%'), 2,
  'five-field list includes only active, reviewed, MVP-approved fixtures');
select is((select count(*)::integer from public.list_public_place_summaries()
  where name like '%fixture%'), 2,
  'summary preserves the three independent public gates');
select is((select count(*)::integer from public.get_public_place_detail(
  '18000000-0000-0000-0000-000000000099')), 0,
  'unreviewed legacy row has no public detail');
select is((select count(*)::integer from public.get_public_place_detail(
  (select place_id from public.place_publications where overture_id =
    '18000000-0000-0000-0000-000000000015'))), 0,
  'reviewed but hidden row has no public detail');
select is(public.get_public_place_attribution(
  '18000000-0000-0000-0000-000000000099'), null::jsonb,
  'unreviewed row has no public attribution');
select is(public.get_public_place_attribution(
  (select place_id from public.place_publications where overture_id =
    '18000000-0000-0000-0000-000000000015')), null::jsonb,
  'hidden row has no public attribution');

select set_eq($$select jsonb_object_keys(to_jsonb(place)) from
  (select * from public.list_public_places() where name = 'Fresh fixture') place$$,
  $$values ('id'),('name'),('city'),('address'),('place_type')$$,
  'list exposes exactly five fields');
select set_eq($$select jsonb_object_keys(to_jsonb(place)) from
  (select * from public.list_public_place_summaries() where name = 'Fresh fixture') place$$,
  $$values ('id'),('name'),('city'),('address'),('address_precision'),
    ('place_type'),('regular_hours_available'),('regular_hours_rule'),
    ('regular_hours_state'),('regular_hours_next_transition_at'),
    ('regular_hours_observed_at'),('outlets'),('wifi'),('work_suitability'),
    ('food_beverage'),('phone_calls_allowed'),('bathroom_available'),
    ('drive_thru_available'),('drive_thru_only'),('kc3_last_verified_at'),
    ('kc3_verification_state')$$,
  'summary contains exactly approved fields');
select set_eq($$select jsonb_object_keys(to_jsonb(detail)) from
  public.get_public_place_detail((select place_id from public.place_publications
    where overture_id = '18000000-0000-0000-0000-000000000012')) detail$$,
  $$values ('id'),('name'),('city'),('address'),('address_precision'),
    ('place_type'),('regular_hours_available'),('regular_hours_rule'),
    ('regular_hours_state'),('regular_hours_next_transition_at'),
    ('regular_hours_observed_at'),('place_local_day_of_week'),('regular_hours'),
    ('seating_notes'),('outlets'),('wifi'),('work_suitability'),
    ('food_beverage'),('phone_calls_allowed'),('bathroom_available'),
    ('drive_thru_available'),('drive_thru_only'),('kc3_last_verified_at'),
    ('kc3_verification_state')$$,
  'detail contains exactly approved fields');
select set_eq($$select jsonb_object_keys(public.get_public_place_attribution(
  (select place_id from public.place_publications where overture_id =
    '18000000-0000-0000-0000-000000000012')))$$,
  $$values ('source'),('sourceUrl'),('licenseUrl'),('licenses'),
    ('fieldSources'),('identityReviewedOn'),('hoursSourceUrl')$$,
  'attribution contains only reviewed source fields');

select ok(not exists (select 1 from public.list_public_place_summaries()
  where name = 'Unknown fixture') and
  (select not hours_available and hours_state = 'unknown'
    from public.kc3_regular_hours_status(
  (select place_id from public.place_publications where overture_id =
    '18000000-0000-0000-0000-000000000011'), now())),
  'unknown hours remain private and resolve to unknown internally');
select is((select count(*)::integer from public.kc3_effective_regular_hours(
  (select place_id from public.place_publications where overture_id =
    '18000000-0000-0000-0000-000000000011'), now())), 0,
  'unknown hours have no invented effective schedule');
select ok((select regular_hours_available and regular_hours_state = 'unknown'
  and regular_hours_next_transition_at is null
  from public.list_public_place_summaries() where name = 'Stale fixture'),
  'old independently sourced weekly hours do not claim current open state');
select is((select jsonb_array_length(regular_hours) from public.get_public_place_detail(
  (select place_id from public.place_publications where overture_id =
    '18000000-0000-0000-0000-000000000013'))), 7,
  'stale detail retains the reviewed schedule');
select is((select hours_state::text from public.kc3_regular_hours_status(
  (select place_id from public.place_publications where overture_id =
    '18000000-0000-0000-0000-000000000012'),
  (current_date + time '12:00') at time zone 'America/Chicago')), 'open',
  'fresh weekly schedule is open at local noon');
select is((select hours_state::text from public.kc3_regular_hours_status(
  (select place_id from public.place_publications where overture_id =
    '18000000-0000-0000-0000-000000000012'),
  (current_date + time '22:00') at time zone 'America/Chicago')), 'closed',
  'fresh weekly schedule closes after local 21:00');
select is((select next_transition_at from public.kc3_regular_hours_status(
  (select place_id from public.place_publications where overture_id =
    '18000000-0000-0000-0000-000000000012'),
  (current_date + time '12:00') at time zone 'America/Chicago')),
  (current_date + time '21:00') at time zone 'America/Chicago',
  'weekly transition is calculated from local schedule');
select ok(not exists (select 1 from public.list_public_place_summaries()
  where name = 'Dawn fixture') and
  (select hours_available from public.kc3_regular_hours_status(
    (select place_id from public.place_publications where overture_id =
      '18000000-0000-0000-0000-000000000014'), now())),
  'dawn policy remains private under the eight-p.m. MVP gate');
select is((select count(*)::integer from public.get_public_place_detail(
  (select place_id from public.place_publications where overture_id =
    '18000000-0000-0000-0000-000000000014'))), 0,
  'dawn-only park has no anonymous detail before MVP eligibility');
select is((select hours_state::text from public.kc3_regular_hours_status(
  bounds.place_id, bounds.opens_at + interval '1 minute')),
  'open', 'dawn policy opens after calculated sunrise')
from (select publication.place_id, dawn.opens_at from public.place_publications publication
  cross join lateral public.kc3_dawn_to_dusk_bounds(publication.place_id, current_date) dawn
  where publication.overture_id = '18000000-0000-0000-0000-000000000014') bounds;
select is((select next_transition_at from public.kc3_regular_hours_status(
  bounds.place_id, bounds.opens_at + interval '1 minute')),
  bounds.closes_at, 'dawn policy transitions at calculated sunset')
from (select publication.place_id, dawn.opens_at, dawn.closes_at
  from public.place_publications publication cross join lateral
  public.kc3_dawn_to_dusk_bounds(publication.place_id, current_date) dawn
  where publication.overture_id = '18000000-0000-0000-0000-000000000014') bounds;
select is((select hours_state::text from public.kc3_regular_hours_status(
  bounds.place_id, bounds.closes_at + interval '1 minute')),
  'closed', 'dawn policy closes after calculated sunset')
from (select publication.place_id, dawn.closes_at from public.place_publications publication
  cross join lateral public.kc3_dawn_to_dusk_bounds(publication.place_id, current_date) dawn
  where publication.overture_id = '18000000-0000-0000-0000-000000000014') bounds;

set local role anon;
select is((select count(*)::integer from public.list_public_places()
  where name like '%fixture%'), 2, 'anonymous list uses all publication gates');
select is((select count(*)::integer from public.list_public_place_summaries()
  where name like '%fixture%'), 2, 'anonymous summary uses all publication gates');
select is((select count(*)::integer from public.get_public_place_detail(
  (select id from public.list_public_place_summaries()
    where name = 'Fresh fixture'))), 1,
  'anonymous detail reads a published identity');
select is((select public.get_public_place_attribution(id)->>'source'
  from public.list_public_place_summaries() where name = 'Fresh fixture'),
  'Overture Maps', 'anonymous attribution identifies Overture');
select throws_ok($$select * from public.places$$, '42501', null,
  'anonymous direct canonical read is denied');
select throws_ok($$select * from public.place_publications$$, '42501', null,
  'anonymous publication ledger read is denied');
select throws_ok($$select * from public.kc3_effective_regular_hours(
  '18000000-0000-0000-0000-000000000099', now())$$,
  '42501', null, 'anonymous direct effective-hours call is denied');
reset role;
select ok(not has_function_privilege('authenticated',
  'public.get_public_place_attribution(uuid)', 'execute') and
  not has_function_privilege('service_role',
    'public.get_public_place_attribution(uuid)', 'execute'),
  'unapproved API roles cannot request attribution');
select ok(not exists (
  select 1 from public.list_public_places() where name like '%Google%'
  union all select 1 from public.list_public_place_summaries() where name like '%Google%'
  union all select 1 from public.get_public_place_detail(
    '18000000-0000-0000-0000-000000000099')
), 'Google sentinel is absent from every public place result');
select ok(not exists (select 1 from public.list_public_place_summaries() summary
  where name like '%fixture%' and to_jsonb(summary)::text ilike '%google%')
  and not exists (select 1 from public.place_publications publication
    where publication.batch_id = '18000000-0000-0000-0000-000000000001'
      and public.get_public_place_attribution(publication.place_id)::text ilike '%google%'),
  'public summaries and attribution contain no Google content');
select * from finish();
rollback;
