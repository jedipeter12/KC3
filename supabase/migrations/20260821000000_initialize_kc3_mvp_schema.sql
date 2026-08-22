create type public.place_type as enum (
  'coffee_shop',
  'cafe',
  'boba_tea',
  'library',
  'coworking',
  'park'
);

create type public.place_status as enum (
  'active',
  'temporarily_closed',
  'permanently_closed',
  'hidden'
);

create type public.outlet_level as enum (
  'none',
  'few',
  'many',
  'unknown'
);

create type public.wifi_type as enum (
  'public',
  'password_printed',
  'password_on_request',
  'none',
  'unknown'
);

create type public.work_suitability as enum (
  'good',
  'okay',
  'poor',
  'unknown'
);

create type public.food_beverage_level as enum (
  'none',
  'light',
  'full',
  'unknown'
);

create type public.hours_source as enum (
  'google',
  'kc3'
);

create table public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  address text not null,
  place_type public.place_type not null,
  google_place_id text unique,
  status public.place_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index places_city_idx on public.places (city);
create index places_place_type_idx on public.places (place_type);
create index places_status_idx on public.places (status);
create index places_name_idx on public.places (name);

create table public.place_google_data (
  place_id uuid primary key references public.places (id) on delete cascade,
  google_name text,
  google_address text,
  google_phone text,
  google_website text,
  google_maps_url text,
  google_business_status text,
  google_primary_type text,
  google_rating numeric(2, 1),
  google_rating_count integer,
  raw_data jsonb,
  last_refreshed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.place_details (
  place_id uuid primary key references public.places (id) on delete cascade,
  seating_notes text,
  outlets public.outlet_level not null default 'unknown',
  wifi public.wifi_type not null default 'unknown',
  work_suitability public.work_suitability not null default 'unknown',
  food_beverage public.food_beverage_level not null default 'unknown',
  phone_calls_allowed boolean,
  bathroom_available boolean,
  last_verified_at date,
  verification_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.place_hours (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  day_of_week smallint not null,
  open_time time,
  close_time time,
  is_closed boolean not null default false,
  closes_next_day boolean not null default false,
  source public.hours_source not null,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint place_hours_day_of_week_check
    check (day_of_week between 0 and 6),
  constraint place_hours_open_closed_times_check
    check (
      (is_closed and open_time is null and close_time is null)
      or
      (not is_closed and open_time is not null and close_time is not null)
    )
);

comment on column public.place_hours.day_of_week is
  'Day of week: 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday.';

create index place_hours_place_id_day_of_week_idx
  on public.place_hours (place_id, day_of_week);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_places_updated_at
before update on public.places
for each row
execute function public.set_updated_at();

create trigger set_place_google_data_updated_at
before update on public.place_google_data
for each row
execute function public.set_updated_at();

create trigger set_place_details_updated_at
before update on public.place_details
for each row
execute function public.set_updated_at();

create trigger set_place_hours_updated_at
before update on public.place_hours
for each row
execute function public.set_updated_at();

alter table public.places enable row level security;
alter table public.place_google_data enable row level security;
alter table public.place_details enable row level security;
alter table public.place_hours enable row level security;
