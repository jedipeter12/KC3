begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(24);

select ok(
  exists (
    select 1
    from pg_roles
    where rolname = 'kc3_public_place_reader'
  ),
  'the dedicated public place reader role exists'
);

select ok(
  (
    select not rolcanlogin
      and not rolinherit
      and not rolsuper
      and not rolcreatedb
      and not rolcreaterole
      and not rolreplication
      and not rolbypassrls
    from pg_roles
    where rolname = 'kc3_public_place_reader'
  ),
  'the public place reader is a hardened NOLOGIN role that cannot bypass RLS'
);

select ok(
  not exists (
    select 1
    from pg_auth_members
    where roleid = 'kc3_public_place_reader'::regrole
      and member = 'postgres'::regrole
      and (inherit_option or set_option)
  ),
  'the migration owner cannot inherit or assume the public place reader role'
);

select ok(
  has_schema_privilege('kc3_public_place_reader', 'public', 'usage')
  and not has_schema_privilege('kc3_public_place_reader', 'public', 'create'),
  'the public place reader can resolve public objects but cannot create them'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename = 'places'
      and policyname = 'public_place_reader_selects_active_places'
      and cmd = 'SELECT'
      and roles = array['kc3_public_place_reader']::name[]
      and qual = '(status = ''active''::place_status)'
  ),
  1,
  'the reader policy permits only active place rows for the dedicated role'
);

select is(
  (
    select pg_get_userbyid(proowner)
    from pg_proc
    where oid = 'public.list_public_places()'::regprocedure
  ),
  'kc3_public_place_reader',
  'the public RPC is owned by the constrained reader role'
);

select ok(
  (
    select prosecdef
      and provolatile = 's'
      and proconfig @> array['search_path=""']
    from pg_proc
    where oid = 'public.list_public_places()'::regprocedure
  ),
  'the public RPC is stable and uses SECURITY DEFINER with an empty search path'
);

select ok(
  has_function_privilege('anon', 'public.list_public_places()', 'execute'),
  'anonymous clients may execute the public place RPC'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.list_public_places()',
    'execute'
  )
  and not has_function_privilege(
    'service_role',
    'public.list_public_places()',
    'execute'
  ),
  'unapproved Data API roles cannot execute the public place RPC'
);

select ok(
  not exists (
    select 1
    from (values ('anon'), ('authenticated'), ('service_role')) as roles(role_name)
    cross join (
      values
        ('public.places'),
        ('public.place_google_data'),
        ('public.place_details'),
        ('public.place_hours'),
        ('public.place_overrides')
    ) as tables(table_name)
    cross join (
      values ('select'), ('insert'), ('update'), ('delete')
    ) as privileges(privilege_name)
    where has_table_privilege(
      roles.role_name,
      tables.table_name,
      privileges.privilege_name
    )
  ),
  'Data API roles retain no direct privileges on base tables'
);

select ok(
  (
    select bool_and(
      has_column_privilege(
        'kc3_public_place_reader',
        'public.places',
        column_name,
        'select'
      )
    )
    from (
      values ('id'), ('name'), ('city'), ('address'), ('place_type'), ('status')
    ) as allowed_columns(column_name)
  ),
  'the internal reader can select only the columns needed to filter and project places'
);

select ok(
  not exists (
    select 1
    from (
      values
        ('google_place_id'), ('latitude'), ('longitude'), ('time_zone'),
        ('moved_to_place_id'), ('created_at'), ('updated_at')
    ) as restricted_columns(column_name)
    where has_column_privilege(
      'kc3_public_place_reader',
      'public.places',
      column_name,
      'select'
    )
  ),
  'the internal reader cannot select unapproved place columns'
);

select set_eq(
  $$
    select jsonb_object_keys(to_jsonb(public_place))
    from (
      select *
      from public.list_public_places()
      limit 1
    ) as public_place
  $$,
  $$ values ('id'), ('name'), ('city'), ('address'), ('place_type') $$,
  'the public RPC returns exactly the approved fields'
);

insert into public.places (id, name, city, address, place_type, status)
values
  (
    '60000000-0000-0000-0000-000000000001',
    'Access Test Active',
    'Kansas City',
    '1 Access Way',
    'cafe',
    'active'
  ),
  (
    '60000000-0000-0000-0000-000000000002',
    'Access Test Temporary',
    'Kansas City',
    '2 Access Way',
    'cafe',
    'temporarily_closed'
  ),
  (
    '60000000-0000-0000-0000-000000000003',
    'Access Test Permanent',
    'Kansas City',
    '3 Access Way',
    'cafe',
    'permanently_closed'
  ),
  (
    '60000000-0000-0000-0000-000000000004',
    'Access Test Hidden',
    'Kansas City',
    '4 Access Way',
    'cafe',
    'hidden'
  );

select results_eq(
  $$
    select id
    from public.list_public_places()
    where id between
      '60000000-0000-0000-0000-000000000001'::uuid
      and '60000000-0000-0000-0000-000000000004'::uuid
  $$,
  $$ values ('60000000-0000-0000-0000-000000000001'::uuid) $$,
  'the public RPC returns active places and excludes every non-active status'
);

set local role anon;

select lives_ok(
  $$ select * from public.list_public_places() $$,
  'anonymous clients can call the public place RPC'
);

select results_eq(
  $$
    select id
    from public.list_public_places()
    where id between
      '60000000-0000-0000-0000-000000000001'::uuid
      and '60000000-0000-0000-0000-000000000004'::uuid
  $$,
  $$ values ('60000000-0000-0000-0000-000000000001'::uuid) $$,
  'anonymous execution preserves the active-only boundary'
);

select throws_ok(
  $$ select id, name from public.places $$,
  '42501',
  null,
  'anonymous clients cannot select directly from places'
);

select throws_ok(
  $$ insert into public.places (name, city, address, place_type) values ('Denied', 'Kansas City', '5 Access Way', 'cafe') $$,
  '42501',
  null,
  'anonymous clients cannot insert places'
);

select throws_ok(
  $$ update public.places set name = 'Denied' where id = '60000000-0000-0000-0000-000000000001' $$,
  '42501',
  null,
  'anonymous clients cannot update places'
);

select throws_ok(
  $$ delete from public.places where id = '60000000-0000-0000-0000-000000000001' $$,
  '42501',
  null,
  'anonymous clients cannot delete places'
);

reset role;
set local role authenticated;

select throws_ok(
  $$ select * from public.list_public_places() $$,
  '42501',
  null,
  'authenticated clients cannot use an API boundary that has not been approved for them'
);

reset role;
set local role postgres;
grant kc3_public_place_reader to postgres;
grant usage on schema extensions to kc3_public_place_reader;
set local role kc3_public_place_reader;

select results_eq(
  $$
    select id
    from public.places
    where id between
      '60000000-0000-0000-0000-000000000001'::uuid
      and '60000000-0000-0000-0000-000000000004'::uuid
  $$,
  $$ values ('60000000-0000-0000-0000-000000000001'::uuid) $$,
  'RLS restricts the internal reader itself to active rows'
);

select throws_ok(
  $$ select google_place_id from public.places $$,
  '42501',
  null,
  'the internal reader cannot access excluded canonical fields'
);

select throws_ok(
  $$ update public.places set name = name $$,
  '42501',
  null,
  'the internal reader cannot write place rows'
);

reset role;
set local role postgres;
revoke usage on schema extensions from kc3_public_place_reader;
revoke kc3_public_place_reader from postgres;
reset role;

select * from finish();

rollback;
