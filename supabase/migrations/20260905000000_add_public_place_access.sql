-- Keep client access behind a narrow RPC instead of granting Data API roles
-- privileges on the canonical tables. The function owner is deliberately not a
-- table owner and cannot bypass RLS.
create role kc3_public_place_reader
  nologin
  noinherit
  nosuperuser
  nocreatedb
  nocreaterole
  noreplication
  nobypassrls;

grant usage on schema public to kc3_public_place_reader;
grant usage on type public.place_type, public.place_status
  to kc3_public_place_reader;
grant select (id, name, city, address, place_type, status)
  on public.places
  to kc3_public_place_reader;

create policy public_place_reader_selects_active_places
on public.places
for select
to kc3_public_place_reader
using (status = 'active');

create function public.list_public_places()
returns table (
  id uuid,
  name text,
  city text,
  address text,
  place_type public.place_type
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    places.id,
    places.name,
    places.city,
    places.address,
    places.place_type
  from public.places
  where places.status = 'active'
  order by places.name, places.id;
$$;

revoke all on function public.list_public_places()
  from public, anon, authenticated, service_role;
grant execute on function public.list_public_places() to anon;

comment on function public.list_public_places() is
  'Returns the approved anonymous, read-only projection of active KC3 places.';

-- PostgreSQL requires the migration owner to be able to SET ROLE to the new
-- owner, and the new owner to have CREATE on the containing schema, during an
-- ownership transfer. Grant both capabilities only for that statement.
grant kc3_public_place_reader to postgres;
grant create on schema public to kc3_public_place_reader;
alter function public.list_public_places() owner to kc3_public_place_reader;
revoke create on schema public from kc3_public_place_reader;
revoke kc3_public_place_reader from postgres;
