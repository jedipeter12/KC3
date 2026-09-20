begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(20);

select ok(
  has_function_privilege('service_role', 'public.kc3_google_import_state()', 'execute'),
  'service role can read the server-only import planning projection'
);

select ok(
  has_function_privilege('service_role', 'public.kc3_import_google_place(jsonb)', 'execute'),
  'service role can execute the narrow import transaction'
);

select ok(
  not has_function_privilege('anon', 'public.kc3_import_google_place(jsonb)', 'execute'),
  'anonymous clients cannot execute imports'
);

select ok(
  not has_function_privilege('authenticated', 'public.kc3_import_google_place(jsonb)', 'execute'),
  'authenticated clients cannot execute imports'
);

select is(
  (select rolcanlogin from pg_roles where rolname = 'kc3_google_importer'),
  false,
  'the constrained import owner cannot log in'
);

select ok(
  not has_table_privilege(
    'kc3_google_importer',
    'public.place_details',
    'insert, update, delete'
  ),
  'the import owner cannot mutate KC3-owned details'
);

select ok(
  not has_table_privilege(
    'kc3_google_importer',
    'public.place_hours',
    'update'
  ),
  'the import owner cannot update KC3-owned hour rows'
);

select throws_ok(
  $sql$
    select public.kc3_import_google_place(
      $json${
        "googlePlaceId":"unsupported-raw",
        "placeType":"cafe",
        "fetchedAt":"2026-09-08T12:00:00Z",
        "provider":{"rawResponse":{"secret":"not allowed"}},
        "canonical":{}
      }$json$::jsonb
    )
  $sql$,
  '22023',
  'normalized fields contain unsupported values',
  'the database boundary rejects unapproved raw provider fields'
);

select lives_ok(
  $sql$
    select public.kc3_import_google_place(
      $json${
        "googlePlaceId":"google-kc3-25",
        "placeType":"coffee_shop",
        "fetchedAt":"2026-09-08T12:00:00Z",
        "provider":{
          "name":"Importer Coffee",
          "address":"25 Import Way, Lenexa, KS 66215",
          "addressComponents":[{"longText":"Lenexa","types":["locality"]}],
          "latitude":38.9500,
          "longitude":-94.7300,
          "businessStatus":"OPERATIONAL",
          "types":["coffee_shop"],
          "timeZone":"America/Chicago",
          "rating":4.5,
          "userRatingCount":10
        },
        "canonical":{
          "name":"Importer Coffee",
          "city":"Lenexa",
          "address":"25 Import Way, Lenexa, KS 66215",
          "latitude":38.9500,
          "longitude":-94.7300,
          "timeZone":"America/Chicago",
          "status":"active"
        },
        "hours":[
          {"dayOfWeek":1,"openTime":"08:00","closeTime":"17:00","isClosed":false,"closesNextDay":false}
        ]
      }$json$::jsonb
    )
  $sql$,
  'a normalized new place imports atomically'
);

select is(
  (select count(*)::integer from public.places where google_place_id = 'google-kc3-25'),
  1,
  'the initial import creates one canonical place'
);

select is(
  (select count(*)::integer from public.place_google_data where google_name = 'Importer Coffee'),
  1,
  'the initial import creates one provider row'
);

select is(
  (
    select count(*)::integer
    from public.place_hours as hours
    join public.places as places on places.id = hours.place_id
    where places.google_place_id = 'google-kc3-25' and hours.source = 'google'
  ),
  1,
  'the initial import writes normalized Google hours'
);

insert into public.place_details (
  place_id, seating_notes, outlets, wifi, work_suitability,
  food_beverage, phone_calls_allowed, bathroom_available,
  last_verified_at, verification_notes
)
select
  id, 'Keep these exact KC3 notes', 'many', 'password_on_request', 'good',
  'light', true, false, '2026-09-01', 'KC3 verified'
from public.places
where google_place_id = 'google-kc3-25';

create temporary table detail_before as
select to_jsonb(details) as snapshot
from public.place_details as details
join public.places as places on places.id = details.place_id
where places.google_place_id = 'google-kc3-25';

insert into public.place_hours (
  place_id, day_of_week, open_time, close_time, source, source_observed_at
)
select id, 2, '09:00', '16:00', 'kc3', '2026-09-01T12:00:00Z'
from public.places
where google_place_id = 'google-kc3-25';

select lives_ok(
  $sql$
    select public.kc3_import_google_place(
      jsonb_build_object(
        'googlePlaceId', 'google-kc3-25',
        'expectedPlaceId', (select id from public.places where google_place_id = 'google-kc3-25'),
        'placeType', 'coffee_shop',
        'fetchedAt', '2026-09-08T13:00:00Z',
        'provider', jsonb_build_object('name', 'Importer-Coffee', 'rating', 4.7),
        'canonical', jsonb_build_object('name', 'Importer-Coffee')
      )
    )
  $sql$,
  'repeat import refreshes the provider identity in place'
);

select is(
  (select count(*)::integer from public.places where google_place_id = 'google-kc3-25'),
  1,
  'repeat import does not create a duplicate canonical place'
);

select is(
  (select google_name from public.place_google_data where place_id = (
    select id from public.places where google_place_id = 'google-kc3-25'
  )),
  'Importer-Coffee',
  'repeat import refreshes a present Google-owned field'
);

select is(
  (select google_address from public.place_google_data where place_id = (
    select id from public.places where google_place_id = 'google-kc3-25'
  )),
  '25 Import Way, Lenexa, KS 66215',
  'repeat import preserves an omitted Google-owned field'
);

select is(
  (
    select to_jsonb(details)
    from public.place_details as details
    join public.places as places on places.id = details.place_id
    where places.google_place_id = 'google-kc3-25'
  ),
  (select snapshot from pg_temp.detail_before),
  'repeat import preserves every KC3 detail field and timestamp'
);

select is(
  (
    select count(*)::integer
    from public.place_hours as hours
    join public.places as places on places.id = hours.place_id
    where places.google_place_id = 'google-kc3-25' and hours.source = 'kc3'
  ),
  1,
  'repeat import preserves KC3-owned hours'
);

select throws_ok(
  $sql$
    select public.kc3_import_google_place(
      jsonb_build_object(
        'googlePlaceId', 'google-kc3-25',
        'placeType', 'coffee_shop',
        'fetchedAt', '2026-09-08T14:00:00Z',
        'provider', jsonb_build_object('rating', 4.9),
        'canonical', '{}'::jsonb,
        'hours', '[]'::jsonb
      )
    )
  $sql$,
  '22023',
  'hours replacement must be a bounded nonempty array',
  'a malformed normalized schedule fails the whole database write'
);

select is(
  (select google_fetched_at from public.place_google_data where place_id = (
    select id from public.places where google_place_id = 'google-kc3-25'
  )),
  '2026-09-08T13:00:00Z'::timestamptz,
  'a failed write does not advance provider freshness'
);

select * from finish();

rollback;
