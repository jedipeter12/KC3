-- KC3-24 adds the storage needed by the approved Google ingestion contract.
-- It deliberately does not grant an import role or expose any new Data API.

create extension if not exists btree_gist with schema extensions;

alter table public.places
  add column latitude double precision,
  add column longitude double precision,
  add column time_zone text,
  add column moved_to_place_id uuid references public.places (id) on delete restrict,
  add constraint places_coordinates_pair_check
    check ((latitude is null) = (longitude is null)),
  add constraint places_latitude_check
    check (latitude is null or latitude between -90 and 90),
  add constraint places_longitude_check
    check (longitude is null or longitude between -180 and 180),
  add constraint places_not_moved_to_self_check
    check (moved_to_place_id is null or moved_to_place_id <> id);

comment on column public.places.latitude is
  'Accepted canonical latitude. Google coordinates remain separately available in place_google_data.';
comment on column public.places.longitude is
  'Accepted canonical longitude. Google coordinates remain separately available in place_google_data.';
comment on column public.places.time_zone is
  'Accepted IANA time-zone ID used to evaluate effective-dated overrides in the place local date.';
comment on column public.places.moved_to_place_id is
  'KC3 relationship from a retained old physical place to its replacement physical place.';

alter table public.place_google_data
  rename column google_website to google_website_uri;
alter table public.place_google_data
  rename column google_maps_url to google_maps_uri;
alter table public.place_google_data
  rename column google_rating_count to google_user_rating_count;
alter table public.place_google_data
  rename column last_refreshed_at to google_fetched_at;

-- These original scaffold columns are outside the approved MVP field mask.
-- No deployed database exists, and removing them prevents a future importer
-- from silently retaining an unrestricted response or expanding into phone data.
alter table public.place_google_data
  drop column google_phone,
  drop column raw_data;

alter table public.place_google_data
  add column google_address_components jsonb,
  add column google_latitude double precision,
  add column google_longitude double precision,
  add column google_types text[],
  add column google_time_zone text,
  add column google_moved_place_id text,
  add column google_price_level text,
  add constraint place_google_data_address_components_check
    check (
      google_address_components is null
      or jsonb_typeof(google_address_components) = 'array'
    ),
  add constraint place_google_data_coordinates_pair_check
    check ((google_latitude is null) = (google_longitude is null)),
  add constraint place_google_data_latitude_check
    check (google_latitude is null or google_latitude between -90 and 90),
  add constraint place_google_data_longitude_check
    check (google_longitude is null or google_longitude between -180 and 180),
  add constraint place_google_data_rating_check
    check (google_rating is null or google_rating between 1 and 5),
  add constraint place_google_data_rating_count_check
    check (google_user_rating_count is null or google_user_rating_count >= 0),
  add constraint place_google_data_business_status_check
    check (
      google_business_status is null
      or google_business_status in (
        'BUSINESS_STATUS_UNSPECIFIED',
        'OPERATIONAL',
        'CLOSED_TEMPORARILY',
        'CLOSED_PERMANENTLY',
        'FUTURE_OPENING'
      )
    ),
  add constraint place_google_data_price_level_check
    check (
      google_price_level is null
      or google_price_level in (
        'PRICE_LEVEL_UNSPECIFIED',
        'PRICE_LEVEL_FREE',
        'PRICE_LEVEL_INEXPENSIVE',
        'PRICE_LEVEL_MODERATE',
        'PRICE_LEVEL_EXPENSIVE',
        'PRICE_LEVEL_VERY_EXPENSIVE'
      )
    );

comment on column public.place_google_data.google_fetched_at is
  'Time KC3 last committed a successful, validated Google response for this listing; it is not a KC3 verification timestamp.';
comment on column public.place_google_data.google_address_components is
  'Allowlisted Google addressComponents field only, not a complete raw response.';
alter table public.place_hours
  rename column last_verified_at to source_observed_at;

comment on column public.place_hours.source_observed_at is
  'For Google rows, the provider fetch time; for KC3 rows, the curation or verification time. This never updates place_details.last_verified_at.';

create table public.place_overrides (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  override_type text not null,
  effective_start_date date not null,
  effective_end_date date,
  override_value jsonb not null,
  source text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint place_overrides_type_not_blank_check
    check (btrim(override_type) <> ''),
  constraint place_overrides_date_order_check
    check (
      effective_end_date is null
      or effective_end_date >= effective_start_date
    ),
  constraint place_overrides_no_overlapping_ranges
    exclude using gist (
      place_id with =,
      override_type with =,
      daterange(
        effective_start_date,
        coalesce(effective_end_date, 'infinity'::date),
        '[]'
      ) with &&
    )
);

comment on table public.place_overrides is
  'KC3-owned factual overrides. Provider values remain unchanged underneath; date bounds are inclusive and evaluated in places.time_zone.';
comment on column public.place_overrides.override_type is
  'Versioned application-level type such as regular_hours.v1; writers must validate the matching JSON payload contract.';

create index place_overrides_place_id_type_idx
  on public.place_overrides (place_id, override_type);

create trigger set_place_overrides_updated_at
before update on public.place_overrides
for each row
execute function public.set_updated_at();

alter table public.place_overrides enable row level security;

revoke all on table public.place_overrides
from anon, authenticated, service_role;

create function public.active_place_override_value(
  target_place_id uuid,
  target_override_type text,
  at_instant timestamptz default now()
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select place_overrides.override_value
  from public.place_overrides as place_overrides
  join public.places as places
    on places.id = place_overrides.place_id
  where place_overrides.place_id = target_place_id
    and place_overrides.override_type = target_override_type
    and places.time_zone is not null
    and place_overrides.effective_start_date
      <= (at_instant at time zone places.time_zone)::date
    and (
      place_overrides.effective_end_date is null
      or place_overrides.effective_end_date
        >= (at_instant at time zone places.time_zone)::date
    )
  limit 1;
$$;

revoke all on function public.active_place_override_value(uuid, text, timestamptz)
from public, anon, authenticated, service_role;

comment on function public.active_place_override_value(uuid, text, timestamptz) is
  'Returns an active override value using the place local calendar date, or null so the read layer can fall back to provider data.';
