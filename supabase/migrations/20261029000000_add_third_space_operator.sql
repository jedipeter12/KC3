-- Attended, source-agnostic review of private discoveries and KC3 classifications.
-- The shared now()-based trigger can reuse a version inside one transaction.
-- Give discovery reviews a monotonic version for optimistic concurrency.
drop trigger set_place_discoveries_updated_at on public.place_discoveries;
create function public.kc3_touch_discovery_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := greatest(
    pg_catalog.clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$$;
revoke all on function public.kc3_touch_discovery_updated_at() from public, anon, authenticated, service_role;
create trigger set_place_discoveries_updated_at before update on public.place_discoveries
  for each row execute function public.kc3_touch_discovery_updated_at();

-- The importer needs canonical/provider fields, never the KC3 publication bit.
revoke insert, update on public.places from kc3_google_importer;
grant insert (name, city, address, place_type, google_place_id, status,
  latitude, longitude, time_zone) on public.places to kc3_google_importer;
grant update (name, city, address, address_precision, google_place_id, status,
  latitude, longitude, time_zone) on public.places to kc3_google_importer;

create role kc3_third_space_operator nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
grant kc3_third_space_operator to postgres;
grant usage, create on schema public to kc3_third_space_operator;
grant usage on type public.discovery_source, public.discovery_verification_state,
  public.activity_type, public.place_type, public.place_status to kc3_third_space_operator;
grant select (id, name, city, address, place_type, status, updated_at, mvp_published)
  on public.places to kc3_third_space_operator;
grant update (mvp_published) on public.places to kc3_third_space_operator;
grant select on public.place_discoveries to kc3_third_space_operator;
grant insert (place_id, source, discovered_at) on public.place_discoveries
  to kc3_third_space_operator;
grant update (verification_state, business_exists, currently_operating,
  publicly_accessible, hours_reviewed, amenities_reviewed, suitability_reviewed,
  is_third_space, mvp_eligible, last_verified_at, verification_notes)
  on public.place_discoveries to kc3_third_space_operator;
grant select (place_id, updated_at, casual_hangout_suitable,
  social_community_suitable, quiet_independent_activity, casual_conversation,
  group_gatherings, meet_new_people, supported_activities, organized_activities,
  free_public_access, purchase_expected, paid_admission, activity_fees)
  on public.place_details to kc3_third_space_operator;
grant insert (place_id, casual_hangout_suitable, social_community_suitable,
  quiet_independent_activity, casual_conversation, group_gatherings,
  meet_new_people, supported_activities, organized_activities,
  free_public_access, purchase_expected, paid_admission, activity_fees)
  on public.place_details to kc3_third_space_operator;
grant update (casual_hangout_suitable, social_community_suitable,
  quiet_independent_activity, casual_conversation, group_gatherings,
  meet_new_people, supported_activities, organized_activities,
  free_public_access, purchase_expected, paid_admission, activity_fees)
  on public.place_details to kc3_third_space_operator;
grant select (id, place_id, day_of_week, open_time, close_time, is_closed,
  closes_next_day, source, source_observed_at, updated_at)
  on public.place_hours to kc3_third_space_operator;

create policy third_space_operator_reads_places on public.places
  for select to kc3_third_space_operator using (true);
create policy third_space_operator_publishes_places on public.places
  for update to kc3_third_space_operator using (true) with check (true);
create policy third_space_operator_reads_discoveries on public.place_discoveries
  for select to kc3_third_space_operator using (true);
create policy third_space_operator_reviews_discoveries on public.place_discoveries
  for update to kc3_third_space_operator using (true) with check (true);
create policy third_space_operator_starts_discoveries on public.place_discoveries
  for insert to kc3_third_space_operator with check (place_id is not null);
create policy third_space_operator_reads_details on public.place_details
  for select to kc3_third_space_operator using (true);
create policy third_space_operator_inserts_details on public.place_details
  for insert to kc3_third_space_operator with check (true);
create policy third_space_operator_updates_details on public.place_details
  for update to kc3_third_space_operator using (true) with check (true);
create policy third_space_operator_reads_hours on public.place_hours
  for select to kc3_third_space_operator using (true);

-- A provider or independent hours write records an outstanding review, but never
-- writes a KC3 assessment or publication field. The public reader hides pending
-- published places until an operator has reviewed the new revision.
create table public.place_hours_eligibility_reviews (
  place_id uuid primary key references public.places(id) on delete cascade,
  hours_revision bigint not null default 0,
  reviewed_revision bigint not null default 0,
  reviewed_effective_override_id uuid,
  constraint reviewed_revision_not_ahead check (reviewed_revision <= hours_revision)
);
alter table public.place_hours_eligibility_reviews enable row level security;
revoke all on public.place_hours_eligibility_reviews from public, anon, authenticated, service_role;
grant select, insert (place_id, hours_revision), update (hours_revision)
  on public.place_hours_eligibility_reviews to kc3_google_importer;
grant select, insert (place_id, hours_revision), update (hours_revision)
  on public.place_hours_eligibility_reviews to kc3_third_space_operator;
grant update (reviewed_revision, reviewed_effective_override_id)
  on public.place_hours_eligibility_reviews to kc3_third_space_operator;
create policy third_space_operator_reads_hours_reviews on public.place_hours_eligibility_reviews
  for select to kc3_third_space_operator using (true);
create policy third_space_operator_inserts_hours_reviews on public.place_hours_eligibility_reviews
  for insert to kc3_third_space_operator with check (true);
create policy third_space_operator_updates_hours_reviews on public.place_hours_eligibility_reviews
  for update to kc3_third_space_operator using (true) with check (true);
create policy google_importer_inserts_hours_reviews on public.place_hours_eligibility_reviews
  for insert to kc3_google_importer with check (true);
create policy google_importer_updates_hours_reviews on public.place_hours_eligibility_reviews
  for update to kc3_google_importer using (true) with check (true);
create policy google_importer_reads_hours_reviews on public.place_hours_eligibility_reviews
  for select to kc3_google_importer using (true);

create function public.kc3_mark_hours_for_eligibility_review()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_id uuid;
begin
  if tg_table_name = 'place_overrides' then
    if tg_op = 'DELETE' and old.override_type <> 'regular_hours.v1' then return null; end if;
    if tg_op = 'INSERT' and new.override_type <> 'regular_hours.v1' then return null; end if;
    if tg_op = 'UPDATE' and old.override_type <> 'regular_hours.v1'
      and new.override_type <> 'regular_hours.v1' then return null; end if;
  end if;
  target_id := case when tg_op = 'DELETE' then old.place_id else new.place_id end;
  -- Cascading deletion of a canonical place also deletes its hours. There is
  -- no remaining place whose eligibility could be reviewed in that case.
  if not exists (select 1 from public.places where id = target_id) then
    return null;
  end if;
  insert into public.place_hours_eligibility_reviews(place_id, hours_revision)
    values (target_id, 1)
    on conflict (place_id) do update set hours_revision =
      public.place_hours_eligibility_reviews.hours_revision + 1;
  if tg_op = 'UPDATE' and old.place_id is distinct from new.place_id then
    if exists (select 1 from public.places where id = old.place_id) then
      insert into public.place_hours_eligibility_reviews(place_id, hours_revision)
        values (old.place_id, 1)
        on conflict (place_id) do update set hours_revision =
          public.place_hours_eligibility_reviews.hours_revision + 1;
    end if;
  end if;
  return null;
end;
$$;
revoke all on function public.kc3_mark_hours_for_eligibility_review() from public, anon, authenticated, service_role;
create trigger mark_hours_eligibility_review
  after insert or delete or update of place_id, day_of_week, open_time,
    close_time, is_closed, closes_next_day, source, source_observed_at
  on public.place_hours for each row
  execute function public.kc3_mark_hours_for_eligibility_review();
create trigger mark_override_eligibility_review
  after insert or delete or update of place_id, override_type, override_value,
    effective_start_date, effective_end_date, source_observed_at
  on public.place_overrides for each row
  execute function public.kc3_mark_hours_for_eligibility_review();

create function public.kc3_operator_effective_hours_json(target_place_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'day', h.day_of_week, 'open', h.open_time, 'close', h.close_time,
    'closed', h.is_closed, 'nextDay', h.closes_next_day,
    'source', h.effective_source, 'observedAt', h.source_observed_at)
    order by h.day_of_week, h.open_time), '[]'::jsonb)
  from public.kc3_effective_regular_hours(target_place_id, now()) h;
$$;
revoke all on function public.kc3_operator_effective_hours_json(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.kc3_operator_effective_hours_json(uuid)
  to kc3_third_space_operator;

create function public.kc3_has_eight_pm_schedule(target_place_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  with effective as materialized (
    select * from public.kc3_effective_regular_hours(target_place_id, now())
  )
  select case when exists (select 1 from effective) then
    exists (select 1 from effective h where not h.is_closed
      and h.open_time <= time '20:00'
      and (h.close_time >= time '20:00' or h.closes_next_day))
  else exists (select 1 from public.place_hours h where h.place_id = target_place_id
    and not h.is_closed and h.open_time <= time '20:00'
    and (h.close_time >= time '20:00' or h.closes_next_day)) end;
$$;
revoke all on function public.kc3_has_eight_pm_schedule(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.kc3_has_eight_pm_schedule(uuid)
  to kc3_third_space_operator;

create or replace function public.kc3_validate_mvp_eligibility()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- A new provider discovery has unknown eligibility. Do not plan the
  -- operator-only hours helper for the importer in that case.
  if new.mvp_eligible is true then
    if not exists (select 1 from public.places p where p.id = new.place_id
      and p.status = 'active' and p.city in ('Lenexa','Overland Park','Olathe'))
      or not public.kc3_has_eight_pm_schedule(new.place_id) then
      raise exception using errcode = '23514',
        message = 'MVP eligibility requires an active target-city place open through 8 p.m.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.kc3_check_mvp_publication()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.mvp_published and not old.mvp_published then
    if new.status <> 'active' or new.city not in ('Lenexa','Overland Park','Olathe')
      or not exists (select 1 from public.place_discoveries d
        where d.place_id = new.id and d.mvp_eligible is true)
      or not public.kc3_has_eight_pm_schedule(new.id)
    then
      raise exception using errcode = '23514',
        message = 'MVP publication requires a verified eligible discovery';
    end if;
  end if;
  return new;
end;
$$;

create function public.kc3_current_effective_override_id(target_place_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select o.id from public.places p join public.place_overrides o
    on o.place_id = p.id
  where p.id = target_place_id and p.time_zone is not null
    and o.override_type = 'regular_hours.v1'
    and o.effective_start_date <= (now() at time zone p.time_zone)::date
    and (o.effective_end_date is null or
      o.effective_end_date >= (now() at time zone p.time_zone)::date)
  limit 1;
$$;
revoke all on function public.kc3_current_effective_override_id(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.kc3_current_effective_override_id(uuid)
  to kc3_third_space_operator;

create function public.kc3_hours_review_pending(target_place_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select hours_revision > reviewed_revision or
    reviewed_effective_override_id is distinct from
      public.kc3_current_effective_override_id(target_place_id)
    from public.place_hours_eligibility_reviews where place_id = target_place_id), false);
$$;
revoke all on function public.kc3_hours_review_pending(uuid) from public, anon, authenticated, service_role;
grant execute on function public.kc3_hours_review_pending(uuid) to kc3_public_place_reader;
grant execute on function public.kc3_hours_review_pending(uuid) to kc3_third_space_operator;
drop policy public_place_reader_selects_active_places on public.places;
create policy public_place_reader_selects_active_places on public.places
  for select to kc3_public_place_reader
  using (status = 'active' and mvp_published and not public.kc3_hours_review_pending(id));

create function public.kc3_third_space_review_json(target_discovery_id uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', d.id::text, 'source', d.source, 'discoveredAt', d.discovered_at,
    'leadName', d.lead_name, 'leadCity', d.lead_city,
    'updatedAt', d.updated_at::text,
    'place', case when p.id is null then null else jsonb_build_object(
      'id', p.id::text, 'name', p.name, 'city', p.city, 'address', p.address,
      'placeType', p.place_type, 'status', p.status,
      'published', p.mvp_published, 'updatedAt', p.updated_at::text) end,
    'review', jsonb_build_object(
      'verificationState', d.verification_state,
      'businessExists', d.business_exists, 'currentlyOperating', d.currently_operating,
      'publiclyAccessible', d.publicly_accessible, 'hoursReviewed', d.hours_reviewed,
      'amenitiesReviewed', d.amenities_reviewed, 'suitabilityReviewed', d.suitability_reviewed,
      'isThirdSpace', d.is_third_space, 'mvpEligible', d.mvp_eligible,
      'lastVerifiedAt', d.last_verified_at, 'verificationNotes', d.verification_notes),
    'detailUpdatedAt', pd.updated_at::text,
    'classification', case when p.id is null then null else jsonb_build_object(
      'casualHangoutSuitable', pd.casual_hangout_suitable,
      'socialCommunitySuitable', pd.social_community_suitable,
      'quietIndependentActivity', pd.quiet_independent_activity,
      'casualConversation', pd.casual_conversation,
      'groupGatherings', pd.group_gatherings, 'meetNewPeople', pd.meet_new_people,
      'supportedActivities', pd.supported_activities,
      'organizedActivities', pd.organized_activities,
      'freePublicAccess', pd.free_public_access,
      'purchaseExpected', pd.purchase_expected, 'paidAdmission', pd.paid_admission,
      'activityFees', pd.activity_fees) end,
    'hoursRevision', coalesce(hr.hours_revision, 0),
    'effectiveOverrideId', public.kc3_current_effective_override_id(p.id)::text,
    'hoursReviewPending', public.kc3_hours_review_pending(p.id),
    'effectiveHours', public.kc3_operator_effective_hours_json(p.id),
    'hours', coalesce((select jsonb_agg(jsonb_build_object(
      'day', h.day_of_week, 'open', h.open_time, 'close', h.close_time,
      'closed', h.is_closed, 'nextDay', h.closes_next_day,
      'source', h.source, 'observedAt', h.source_observed_at)
      order by h.day_of_week, h.open_time, h.id)
      from public.place_hours h where h.place_id = p.id), '[]'::jsonb)
  )
  from public.place_discoveries d
  left join public.places p on p.id = d.place_id
  left join public.place_details pd on pd.place_id = p.id
  left join public.place_hours_eligibility_reviews hr on hr.place_id = p.id
  where d.id = target_discovery_id;
$$;
revoke all on function public.kc3_third_space_review_json(uuid) from public, anon, authenticated, service_role;
alter function public.kc3_third_space_review_json(uuid) owner to kc3_third_space_operator;

create function public.kc3_get_unreviewed_third_space_place(target_place_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id::text, 'name', p.name, 'city', p.city, 'address', p.address,
    'placeType', p.place_type, 'status', p.status, 'published', p.mvp_published,
    'updatedAt', p.updated_at::text,
    'classification', jsonb_build_object(
      'casualHangoutSuitable', pd.casual_hangout_suitable,
      'socialCommunitySuitable', pd.social_community_suitable,
      'quietIndependentActivity', pd.quiet_independent_activity,
      'casualConversation', pd.casual_conversation,
      'groupGatherings', pd.group_gatherings, 'meetNewPeople', pd.meet_new_people,
      'supportedActivities', pd.supported_activities,
      'organizedActivities', pd.organized_activities,
      'freePublicAccess', pd.free_public_access,
      'purchaseExpected', pd.purchase_expected, 'paidAdmission', pd.paid_admission,
      'activityFees', pd.activity_fees),
    'effectiveHours', public.kc3_operator_effective_hours_json(p.id),
    'hours', coalesce((select jsonb_agg(jsonb_build_object(
      'day', h.day_of_week, 'open', h.open_time, 'close', h.close_time,
      'closed', h.is_closed, 'nextDay', h.closes_next_day,
      'source', h.source, 'observedAt', h.source_observed_at)
      order by h.day_of_week, h.open_time, h.id)
      from public.place_hours h where h.place_id = p.id), '[]'::jsonb))
  from public.places p left join public.place_details pd on pd.place_id = p.id
  where p.id = target_place_id and not exists
    (select 1 from public.place_discoveries d where d.place_id = p.id);
$$;
revoke all on function public.kc3_get_unreviewed_third_space_place(uuid)
  from public, anon, authenticated;
alter function public.kc3_get_unreviewed_third_space_place(uuid)
  owner to kc3_third_space_operator;
grant execute on function public.kc3_get_unreviewed_third_space_place(uuid)
  to service_role;

create function public.kc3_start_third_space_review(target_place_id uuid,
  source_value public.discovery_source, discovered_on date,
  expected_place_updated_at text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_version text;
declare new_id uuid;
begin
  select p.updated_at::text into current_version from public.places p
    where p.id = target_place_id for update;
  if current_version is null then
    raise exception using errcode = 'P0002', message = 'canonical place not found';
  end if;
  if current_version is distinct from expected_place_updated_at then
    raise exception using errcode = '40001', message = 'canonical place changed after selection';
  end if;
  if discovered_on is null or discovered_on > current_date then
    raise exception using errcode = '22023', message = 'invalid discovery date';
  end if;
  insert into public.place_discoveries(place_id,source,discovered_at)
    values(target_place_id,source_value,discovered_on) returning id into new_id;
  return public.kc3_third_space_review_json(new_id);
end;
$$;
revoke all on function public.kc3_start_third_space_review(uuid,public.discovery_source,date,text)
  from public, anon, authenticated;
alter function public.kc3_start_third_space_review(uuid,public.discovery_source,date,text)
  owner to kc3_third_space_operator;
grant execute on function public.kc3_start_third_space_review(uuid,public.discovery_source,date,text)
  to service_role;

create function public.kc3_search_third_space_reviews(name_query text, city_query text, source_query text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(public.kc3_third_space_review_json(d.id)
    order by d.discovered_at desc, d.id), '[]'::jsonb)
  from (select d.id, d.discovered_at from public.place_discoveries d
    left join public.places p on p.id = d.place_id
    where (nullif(btrim(name_query), '') is null or
      coalesce(p.name, d.lead_name) ilike '%' || btrim(name_query) || '%')
      and (nullif(btrim(city_query), '') is null or
        lower(coalesce(p.city, d.lead_city)) = lower(btrim(city_query)))
      and (nullif(btrim(source_query), '') is null or d.source::text = btrim(source_query))
    order by d.discovered_at desc, d.id limit 50) d;
$$;
revoke all on function public.kc3_search_third_space_reviews(text,text,text) from public, anon, authenticated;
alter function public.kc3_search_third_space_reviews(text,text,text) owner to kc3_third_space_operator;
grant execute on function public.kc3_search_third_space_reviews(text,text,text) to service_role;

create function public.kc3_save_third_space_review(target_discovery_id uuid, payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  d public.place_discoveries%rowtype;
  p record;
  current_detail_version text;
  current_hours_revision bigint;
  r jsonb;
  c jsonb;
  key text;
  selected_value jsonb;
begin
  if payload is null or jsonb_typeof(payload) <> 'object'
    or payload - array['expectedUpdatedAt','expectedPlaceUpdatedAt','expectedDetailUpdatedAt',
      'expectedHoursRevision','expectedEffectiveOverrideId','review','classification','published','reviewHours'] <> '{}'::jsonb
    or not payload ?& array['expectedUpdatedAt','expectedPlaceUpdatedAt','expectedDetailUpdatedAt',
      'expectedHoursRevision','expectedEffectiveOverrideId','review','classification','published','reviewHours']
    or jsonb_typeof(payload->'review') <> 'object'
    or jsonb_typeof(payload->'reviewHours') <> 'boolean'
    or jsonb_typeof(payload->'expectedHoursRevision') <> 'number'
    or jsonb_typeof(payload->'expectedEffectiveOverrideId') not in ('string','null')
  then raise exception using errcode='22023', message='invalid third-space review payload'; end if;
  r := payload->'review'; c := payload->'classification';
  if r - array['verificationState','businessExists','currentlyOperating',
    'publiclyAccessible','hoursReviewed','amenitiesReviewed','suitabilityReviewed',
    'isThirdSpace','mvpEligible','lastVerifiedAt','verificationNotes'] <> '{}'::jsonb
    or not r ?& array['verificationState','businessExists','currentlyOperating',
    'publiclyAccessible','hoursReviewed','amenitiesReviewed','suitabilityReviewed',
    'isThirdSpace','mvpEligible','lastVerifiedAt','verificationNotes']
    or r->>'verificationState' not in ('discovered','in_review','verified')
  then raise exception using errcode='22023', message='invalid discovery review fields'; end if;
  foreach key in array array['businessExists','currentlyOperating','publiclyAccessible',
    'hoursReviewed','amenitiesReviewed','suitabilityReviewed','isThirdSpace','mvpEligible'] loop
    if jsonb_typeof(r->key) not in ('boolean','null') then
      raise exception using errcode='22023', message='invalid nullable discovery fact';
    end if;
  end loop;
  if jsonb_typeof(r->'lastVerifiedAt') not in ('string','null')
    or jsonb_typeof(r->'verificationNotes') not in ('string','null') then
    raise exception using errcode='22023', message='invalid discovery verification metadata'; end if;
  if c <> 'null'::jsonb then
    if jsonb_typeof(c) <> 'object' or c - array[
      'casualHangoutSuitable','socialCommunitySuitable','quietIndependentActivity',
      'casualConversation','groupGatherings','meetNewPeople','supportedActivities',
      'organizedActivities','freePublicAccess','purchaseExpected','paidAdmission','activityFees'
    ] <> '{}'::jsonb or not c ?& array[
      'casualHangoutSuitable','socialCommunitySuitable','quietIndependentActivity',
      'casualConversation','groupGatherings','meetNewPeople','supportedActivities',
      'organizedActivities','freePublicAccess','purchaseExpected','paidAdmission','activityFees'
    ] then raise exception using errcode='22023', message='invalid classification fields'; end if;
    foreach key in array array['casualHangoutSuitable','socialCommunitySuitable',
      'quietIndependentActivity','casualConversation','groupGatherings','meetNewPeople',
      'freePublicAccess','purchaseExpected','paidAdmission','activityFees'] loop
      if jsonb_typeof(c->key) not in ('boolean','null') then
        raise exception using errcode='22023', message='invalid nullable classification fact'; end if;
    end loop;
    foreach key in array array['supportedActivities','organizedActivities'] loop
      selected_value := c->key;
      if jsonb_typeof(selected_value) not in ('array','null') or
        (jsonb_typeof(selected_value) = 'array' and exists (
          select 1 from jsonb_array_elements_text(selected_value) a(value)
          where a.value not in ('board_games','community_gathering','workshop','hobby_meetup','organized_social')
        )) then raise exception using errcode='22023', message='invalid activity classification'; end if;
    end loop;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_discovery_id::text, 12633429));
  select * into d from public.place_discoveries where id = target_discovery_id for update;
  if not found then raise exception using errcode='P0002', message='discovery not found'; end if;
  if d.updated_at::text is distinct from payload->>'expectedUpdatedAt' then
    raise exception using errcode='40001', message='discovery changed after selection'; end if;
  if d.place_id is not null then
    select id, updated_at, mvp_published, status, city into p
      from public.places where id = d.place_id for update;
    if p.updated_at::text is distinct from payload->>'expectedPlaceUpdatedAt' then
      raise exception using errcode='40001', message='place changed after selection'; end if;
    select updated_at::text into current_detail_version from public.place_details
      where place_id = d.place_id for update;
    if current_detail_version is distinct from payload->>'expectedDetailUpdatedAt' then
      raise exception using errcode='40001', message='classification changed after selection'; end if;
    select coalesce(hours_revision,0) into current_hours_revision
      from public.place_hours_eligibility_reviews where place_id = d.place_id for update;
    current_hours_revision := coalesce(current_hours_revision,0);
    if current_hours_revision <> (payload->>'expectedHoursRevision')::bigint then
      raise exception using errcode='40001', message='hours changed after selection'; end if;
    if public.kc3_current_effective_override_id(d.place_id)::text
      is distinct from payload->>'expectedEffectiveOverrideId' then
      raise exception using errcode='40001', message='effective hours changed after selection';
    end if;
    if jsonb_typeof(payload->'published') <> 'boolean' or c = 'null'::jsonb then
      raise exception using errcode='22023', message='linked place requires classification and publication'; end if;
  elsif payload->'published' <> 'null'::jsonb or c <> 'null'::jsonb
    or payload->'reviewHours' = 'true'::jsonb then
    raise exception using errcode='22023', message='unlinked lead cannot edit a canonical place';
  end if;
  if (d.verification_state::text, d.is_third_space, d.mvp_eligible)
    is distinct from (r->>'verificationState', (r->>'isThirdSpace')::boolean,
      (r->>'mvpEligible')::boolean) then
    update public.place_discoveries set
      verification_state=(r->>'verificationState')::public.discovery_verification_state,
      business_exists=(r->>'businessExists')::boolean,
      currently_operating=(r->>'currentlyOperating')::boolean,
      publicly_accessible=(r->>'publiclyAccessible')::boolean,
      hours_reviewed=(r->>'hoursReviewed')::boolean,
      amenities_reviewed=(r->>'amenitiesReviewed')::boolean,
      suitability_reviewed=(r->>'suitabilityReviewed')::boolean,
      is_third_space=(r->>'isThirdSpace')::boolean,
      mvp_eligible=(r->>'mvpEligible')::boolean,
      last_verified_at=(r->>'lastVerifiedAt')::date,
      verification_notes=r->>'verificationNotes'
    where id=target_discovery_id;
  elsif (d.business_exists, d.currently_operating, d.publicly_accessible,
      d.hours_reviewed, d.amenities_reviewed, d.suitability_reviewed,
      d.last_verified_at, d.verification_notes)
    is distinct from ((r->>'businessExists')::boolean,
      (r->>'currentlyOperating')::boolean, (r->>'publiclyAccessible')::boolean,
      (r->>'hoursReviewed')::boolean, (r->>'amenitiesReviewed')::boolean,
      (r->>'suitabilityReviewed')::boolean, (r->>'lastVerifiedAt')::date,
      r->>'verificationNotes') then
    update public.place_discoveries set
      business_exists=(r->>'businessExists')::boolean,
      currently_operating=(r->>'currentlyOperating')::boolean,
      publicly_accessible=(r->>'publiclyAccessible')::boolean,
      hours_reviewed=(r->>'hoursReviewed')::boolean,
      amenities_reviewed=(r->>'amenitiesReviewed')::boolean,
      suitability_reviewed=(r->>'suitabilityReviewed')::boolean,
      last_verified_at=(r->>'lastVerifiedAt')::date,
      verification_notes=r->>'verificationNotes'
    where id=target_discovery_id;
  end if;
  if d.place_id is not null then
    if c is distinct from
      (public.kc3_third_space_review_json(target_discovery_id)->'classification') then
    insert into public.place_details(place_id, casual_hangout_suitable,
      social_community_suitable, quiet_independent_activity, casual_conversation,
      group_gatherings, meet_new_people, supported_activities, organized_activities,
      free_public_access, purchase_expected, paid_admission, activity_fees)
    values (d.place_id, (c->>'casualHangoutSuitable')::boolean,
      (c->>'socialCommunitySuitable')::boolean, (c->>'quietIndependentActivity')::boolean,
      (c->>'casualConversation')::boolean, (c->>'groupGatherings')::boolean,
      (c->>'meetNewPeople')::boolean,
      case when c->'supportedActivities' = 'null'::jsonb then null
        else array(select value::public.activity_type from jsonb_array_elements_text(c->'supportedActivities') a(value)) end,
      case when c->'organizedActivities' = 'null'::jsonb then null
        else array(select value::public.activity_type from jsonb_array_elements_text(c->'organizedActivities') a(value)) end,
      (c->>'freePublicAccess')::boolean, (c->>'purchaseExpected')::boolean,
      (c->>'paidAdmission')::boolean, (c->>'activityFees')::boolean)
    on conflict (place_id) do update set
      casual_hangout_suitable=excluded.casual_hangout_suitable,
      social_community_suitable=excluded.social_community_suitable,
      quiet_independent_activity=excluded.quiet_independent_activity,
      casual_conversation=excluded.casual_conversation,
      group_gatherings=excluded.group_gatherings,
      meet_new_people=excluded.meet_new_people,
      supported_activities=excluded.supported_activities,
      organized_activities=excluded.organized_activities,
      free_public_access=excluded.free_public_access,
      purchase_expected=excluded.purchase_expected,
      paid_admission=excluded.paid_admission,
      activity_fees=excluded.activity_fees;
    end if;
    if payload->'reviewHours' = 'true'::jsonb then
      if payload->'published' = 'true'::jsonb and
        ((r->>'verificationState') <> 'verified' or (r->>'mvpEligible')::boolean is distinct from true
          or (r->>'hoursReviewed')::boolean is distinct from true
          or not public.kc3_has_eight_pm_schedule(d.place_id)) then
        raise exception using errcode='23514', message='hours review requires verified eligibility to retain publication';
      end if;
      update public.place_hours_eligibility_reviews set
        reviewed_revision=hours_revision,
        reviewed_effective_override_id=public.kc3_current_effective_override_id(d.place_id)
        where place_id=d.place_id;
    end if;
    if payload->'published' = 'true'::jsonb and
      (select public.kc3_hours_review_pending(d.place_id)) then
      raise exception using errcode='23514', message='hours change requires eligibility review before publication';
    end if;
    update public.places set mvp_published=(payload->>'published')::boolean
      where id=d.place_id and mvp_published is distinct from (payload->>'published')::boolean;
  end if;
  return public.kc3_third_space_review_json(target_discovery_id);
end;
$$;
revoke all on function public.kc3_save_third_space_review(uuid,jsonb) from public, anon, authenticated;
alter function public.kc3_save_third_space_review(uuid,jsonb) owner to kc3_third_space_operator;
grant execute on function public.kc3_save_third_space_review(uuid,jsonb) to service_role;
revoke create on schema public from kc3_third_space_operator;
revoke kc3_third_space_operator from postgres;
