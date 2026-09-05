begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(21);

insert into public.places (id, name, city, address, place_type)
values (
  '30000000-0000-0000-0000-000000000001',
  'Hours Test Cafe',
  'Kansas City',
  '30 Main St',
  'cafe'
);

select lives_ok(
  $$
    insert into public.place_hours (place_id, day_of_week, open_time, close_time, source)
    values ('30000000-0000-0000-0000-000000000001', 0, '08:00', '16:00', 'google')
  $$,
  'Sunday is accepted as weekday zero'
);

select lives_ok(
  $$
    insert into public.place_hours (place_id, day_of_week, is_closed, source)
    values ('30000000-0000-0000-0000-000000000001', 6, true, 'kc3')
  $$,
  'Saturday is accepted as weekday six and may be marked closed'
);

select throws_ok(
  $$
    insert into public.place_hours (place_id, day_of_week, open_time, close_time, source)
    values ('30000000-0000-0000-0000-000000000001', -1, '08:00', '16:00', 'kc3')
  $$,
  '23514',
  null,
  'weekday values below Sunday are rejected'
);

select throws_ok(
  $$
    insert into public.place_hours (place_id, day_of_week, open_time, close_time, source)
    values ('30000000-0000-0000-0000-000000000001', 7, '08:00', '16:00', 'kc3')
  $$,
  '23514',
  null,
  'weekday values above Saturday are rejected'
);

select throws_ok(
  $$
    insert into public.place_hours (place_id, day_of_week, open_time, close_time, source)
    values ('30000000-0000-0000-0000-000000000001', null, '08:00', '16:00', 'kc3')
  $$,
  '23502',
  null,
  'weekday is required'
);

select throws_ok(
  $$
    insert into public.place_hours (place_id, day_of_week, open_time, close_time, source)
    values ('30000000-0000-0000-0000-000000000001', 1, '08:00', '16:00', null)
  $$,
  '23502',
  null,
  'hours source is required'
);

select throws_ok(
  $$
    insert into public.place_hours (place_id, day_of_week, open_time, close_time, source)
    values (null, 1, '08:00', '16:00', 'kc3')
  $$,
  '23502',
  null,
  'hours must identify a place'
);

select throws_ok(
  $$
    insert into public.place_hours (
      place_id, day_of_week, open_time, close_time, is_closed, source
    ) values (
      '30000000-0000-0000-0000-000000000001', 1, '08:00', '16:00', null, 'kc3'
    )
  $$,
  '23502',
  null,
  'open or closed state is required'
);

select throws_ok(
  $$
    insert into public.place_hours (
      place_id, day_of_week, open_time, close_time, closes_next_day, source
    ) values (
      '30000000-0000-0000-0000-000000000001', 1, '08:00', '16:00', null, 'kc3'
    )
  $$,
  '23502',
  null,
  'same-day or next-day closing state is required'
);

select throws_ok(
  $$
    insert into public.place_hours (place_id, day_of_week, source)
    values ('30000000-0000-0000-0000-000000000001', 1, 'kc3')
  $$,
  '23514',
  null,
  'an open interval cannot omit both times'
);

select throws_ok(
  $$
    insert into public.place_hours (place_id, day_of_week, open_time, source)
    values ('30000000-0000-0000-0000-000000000001', 1, '08:00', 'kc3')
  $$,
  '23514',
  null,
  'an open interval cannot omit its closing time'
);

select throws_ok(
  $$
    insert into public.place_hours (place_id, day_of_week, close_time, source)
    values ('30000000-0000-0000-0000-000000000001', 1, '16:00', 'kc3')
  $$,
  '23514',
  null,
  'an open interval cannot omit its opening time'
);

select throws_ok(
  $$
    insert into public.place_hours (
      place_id, day_of_week, open_time, close_time, is_closed, source
    ) values (
      '30000000-0000-0000-0000-000000000001', 1, '08:00', '16:00', true, 'kc3'
    )
  $$,
  '23514',
  null,
  'a closed day cannot retain opening and closing times'
);

select is(
  (select is_closed from public.place_hours where day_of_week = 0),
  false,
  'hours default to an open interval'
);

select is(
  (select closes_next_day from public.place_hours where day_of_week = 0),
  false,
  'hours default to closing on the same day'
);

select ok(
  (
    select open_time is null and close_time is null
    from public.place_hours
    where day_of_week = 6
  ),
  'closed days retain null opening and closing times'
);

select lives_ok(
  $$
    insert into public.place_hours (place_id, day_of_week, open_time, close_time, source)
    values
      ('30000000-0000-0000-0000-000000000001', 2, '08:00', '12:00', 'kc3'),
      ('30000000-0000-0000-0000-000000000001', 2, '13:00', '17:00', 'kc3')
  $$,
  'multiple intervals are accepted for one place and weekday'
);

select is(
  (
    select count(*)::integer
    from public.place_hours
    where place_id = '30000000-0000-0000-0000-000000000001'
      and day_of_week = 2
  ),
  2,
  'split operating periods remain separate rows'
);

select lives_ok(
  $$
    insert into public.place_hours (
      place_id, day_of_week, open_time, close_time, closes_next_day, source
    ) values (
      '30000000-0000-0000-0000-000000000001', 5, '18:00', '02:00', true, 'kc3'
    )
  $$,
  'an explicitly marked overnight interval is accepted'
);

select ok(
  (
    select closes_next_day and open_time = '18:00'::time and close_time = '02:00'::time
    from public.place_hours
    where place_id = '30000000-0000-0000-0000-000000000001'
      and day_of_week = 5
  ),
  'overnight closing metadata and times are retained'
);

select throws_ok(
  $$
    insert into public.place_hours (place_id, day_of_week, open_time, close_time, source)
    values ('40000000-0000-0000-0000-000000000001', 1, '08:00', '16:00', 'kc3')
  $$,
  '23503',
  null,
  'hours cannot exist without a canonical place'
);

select * from finish();

rollback;
