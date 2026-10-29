-- Extend KC3-owned classification without changing Google-owned tables or RPC shapes.
alter type public.place_type add value if not exists 'bookstore';
alter type public.place_type add value if not exists 'board_game_cafe';
alter type public.place_type add value if not exists 'gaming_venue';
alter type public.place_type add value if not exists 'community_center';
alter type public.place_type add value if not exists 'hobby_space';
alter type public.place_type add value if not exists 'community_venue';

create type public.activity_type as enum (
  'board_games', 'community_gathering', 'workshop', 'hobby_meetup',
  'organized_social'
);
create type public.discovery_source as enum (
  'google_places', 'overture', 'reddit', 'community_suggestion', 'manual_research'
);
create type public.discovery_verification_state as enum (
  'discovered', 'in_review', 'verified'
);

alter table public.place_details
  add column casual_hangout_suitable boolean,
  add column social_community_suitable boolean,
  add column quiet_independent_activity boolean,
  add column casual_conversation boolean,
  add column group_gatherings boolean,
  add column meet_new_people boolean,
  add column supported_activities public.activity_type[],
  add column organized_activities public.activity_type[],
  add column free_public_access boolean,
  add column purchase_expected boolean,
  add column paid_admission boolean,
  add column activity_fees boolean,
  add constraint place_details_supported_activities_no_null
    check (array_position(supported_activities, null) is null),
  add constraint place_details_organized_activities_no_null
    check (array_position(organized_activities, null) is null);

comment on column public.place_details.casual_hangout_suitable is
  'KC3-owned suitability: null unknown, true suitable, false unsuitable. work_suitability remains the work/study dimension.';
comment on column public.place_details.social_community_suitable is
  'KC3-owned social/community suitability; null means unknown.';
comment on column public.place_details.supported_activities is
  'Supported activities: null unknown, empty array confirmed none. Independent of organized activities.';
comment on column public.place_details.organized_activities is
  'Regularly hosted organized activity types, not scheduled events. Null unknown; empty array confirmed none.';
comment on column public.place_details.free_public_access is
  'Financial access to staying, unrelated to physical accessibility; null unknown.';

create index place_details_casual_hangout_idx on public.place_details (place_id)
  where casual_hangout_suitable is true;
create index place_details_social_community_idx on public.place_details (place_id)
  where social_community_suitable is true;
create index place_details_supported_activities_idx on public.place_details
  using gin (supported_activities);
create index place_details_organized_activities_idx on public.place_details
  using gin (organized_activities);

-- A private candidate is independent of operational status. Preexisting rows
-- remain published; new imports default private. Direct administrative bootstrap
-- can explicitly insert published curated rows, as the local seed does.
alter table public.places add column mvp_published boolean not null default false;
update public.places set mvp_published = true;
create index places_mvp_public_idx on public.places (name, id)
  where status = 'active' and mvp_published;
comment on column public.places.mvp_published is
  'Explicit KC3 MVP publication gate; independent of operational status, third-space value, and provider refresh.';

create table public.place_discoveries (
  id uuid primary key default gen_random_uuid(),
  place_id uuid unique references public.places (id) on delete cascade,
  lead_name text,
  lead_city text,
  source public.discovery_source not null,
  discovered_at date not null default current_date,
  verification_state public.discovery_verification_state not null default 'discovered',
  business_exists boolean,
  currently_operating boolean,
  publicly_accessible boolean,
  hours_reviewed boolean,
  amenities_reviewed boolean,
  suitability_reviewed boolean,
  is_third_space boolean,
  mvp_eligible boolean,
  last_verified_at date,
  verification_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint place_discoveries_lead_identity_check check (
    place_id is not null or (nullif(btrim(lead_name), '') is not null
      and nullif(btrim(lead_city), '') is not null)
  ),
  constraint place_discoveries_verified_check check (
    verification_state <> 'verified' or (
      business_exists is true and currently_operating is true
      and publicly_accessible is true and hours_reviewed is true
      and amenities_reviewed is true and suitability_reviewed is true
      and last_verified_at is not null
    )
  ),
  constraint place_discoveries_eligible_check check (
    mvp_eligible is distinct from true or (
      verification_state = 'verified' and is_third_space is true
      and place_id is not null
    )
  ),
  constraint place_discoveries_dates_check check (
    discovered_at <= current_date and
    (last_verified_at is null or last_verified_at <= current_date)
  )
);
create index place_discoveries_source_date_idx
  on public.place_discoveries (source, discovered_at);
create index place_discoveries_review_idx
  on public.place_discoveries (verification_state, mvp_eligible);
create trigger set_place_discoveries_updated_at
  before update on public.place_discoveries
  for each row execute function public.set_updated_at();
alter table public.place_discoveries enable row level security;
revoke all on public.place_discoveries from public, anon, authenticated, service_role;
comment on table public.place_discoveries is
  'Private leads and review. Recommendations are discovery leads, not authoritative facts; do not store recommender identities.';

-- Google ingestion records provenance but has no privilege on KC3 assessments.
grant usage on type public.discovery_source, public.discovery_verification_state
  to kc3_google_importer;
grant insert (place_id, source, discovered_at)
  on public.place_discoveries to kc3_google_importer;
create policy google_importer_creates_discovery
  on public.place_discoveries for insert to kc3_google_importer
  with check (source = 'google_places' and verification_state = 'discovered'
    and mvp_eligible is null and is_third_space is null);
create function public.kc3_register_google_discovery()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.google_place_id is not null then
    insert into public.place_discoveries (place_id, source, discovered_at)
    values (new.id, 'google_places', current_date);
  end if;
  return new;
end;
$$;
revoke all on function public.kc3_register_google_discovery()
  from public, anon, authenticated, service_role;
create trigger register_google_discovery
  after insert on public.places for each row
  when (new.google_place_id is not null)
  execute function public.kc3_register_google_discovery();

create function public.kc3_validate_mvp_eligibility()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.mvp_eligible is true and (
    not exists (
      select 1 from public.places as place
      where place.id = new.place_id and place.status = 'active'
        and place.city in ('Lenexa', 'Overland Park', 'Olathe')
    )
    or not exists (
      select 1 from public.place_hours as hours
      where hours.place_id = new.place_id and not hours.is_closed
        and hours.open_time <= time '20:00'
        and (hours.close_time >= time '20:00' or hours.closes_next_day)
    )
  ) then
    raise exception using errcode = '23514',
      message = 'MVP eligibility requires an active target-city place open through 8 p.m.';
  end if;
  return new;
end;
$$;
revoke all on function public.kc3_validate_mvp_eligibility()
  from public, anon, authenticated, service_role;
create trigger validate_mvp_eligibility
  before insert or update of mvp_eligible, place_id on public.place_discoveries
  for each row execute function public.kc3_validate_mvp_eligibility();

-- Re-publishing a private candidate requires verified eligibility, target-city
-- scope, and a known interval covering 8 p.m. Existing public rows are grandfathered.
create function public.kc3_check_mvp_publication()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.mvp_published and not old.mvp_published then
    if new.status <> 'active' or new.city not in ('Lenexa', 'Overland Park', 'Olathe')
      or not exists (
        select 1 from public.place_discoveries as discovery
        where discovery.place_id = new.id and discovery.mvp_eligible is true
      )
      or not exists (
        select 1 from public.place_hours as hours
        where hours.place_id = new.id and not hours.is_closed
          and hours.open_time <= time '20:00'
          and (hours.close_time >= time '20:00' or hours.closes_next_day)
      )
    then
      raise exception using errcode = '23514',
        message = 'MVP publication requires a verified eligible discovery';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.kc3_check_mvp_publication()
  from public, anon, authenticated, service_role;
create trigger check_mvp_publication
  before update of mvp_published on public.places
  for each row execute function public.kc3_check_mvp_publication();

create function public.kc3_unpublish_ineligible_discovery()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.place_id is not null then
      update public.places set mvp_published = false where id = old.place_id;
    end if;
    return old;
  end if;
  if old.place_id is distinct from new.place_id and old.place_id is not null then
    update public.places set mvp_published = false where id = old.place_id;
  end if;
  if new.place_id is not null and (
    new.mvp_eligible is distinct from true
      or new.verification_state <> 'verified' or new.is_third_space is distinct from true
  ) then
    update public.places set mvp_published = false where id = new.place_id;
  end if;
  return new;
end;
$$;
revoke all on function public.kc3_unpublish_ineligible_discovery()
  from public, anon, authenticated, service_role;
create trigger unpublish_ineligible_discovery
  after update of mvp_eligible, verification_state, is_third_space, place_id
    or delete on public.place_discoveries
  for each row execute function public.kc3_unpublish_ineligible_discovery();

-- All three anonymous RPCs run as kc3_public_place_reader, so one RLS change
-- gates their existing signatures and result shapes.
drop policy public_place_reader_selects_active_places on public.places;
grant select (mvp_published) on public.places to kc3_public_place_reader;
create policy public_place_reader_selects_active_places
  on public.places for select to kc3_public_place_reader
  using (status = 'active' and mvp_published);
