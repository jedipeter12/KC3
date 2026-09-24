begin;

select plan(3);

update public.places
set time_zone = 'America/Chicago'
where id = '6b633300-0000-4000-8000-000000000001';

select is(
  (
    select pg_get_userbyid(proowner)
    from pg_proc
    where oid = 'public.get_public_place_detail(uuid)'::regprocedure
  ),
  'kc3_public_place_reader',
  'the revised detail RPC retains its constrained owner'
);

select ok(
  (
    select place_local_day_of_week between 0 and 6
    from public.get_public_place_detail(
      '6b633300-0000-4000-8000-000000000001'
    )
  ),
  'detail returns a derived place-local weekday for a place with a timezone'
);

select ok(
  (
    select to_jsonb(detail) ? 'place_local_day_of_week'
      and not (to_jsonb(detail) ? 'time_zone')
    from public.get_public_place_detail(
      '6b633300-0000-4000-8000-000000000001'
    ) as detail
  ),
  'detail exposes the derived weekday without exposing the timezone'
);

select * from finish();

rollback;
