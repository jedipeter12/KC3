begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(8);

insert into public.places (id, name, city, address, place_type)
values
  (
    '6b633300-9999-4000-8000-000000000001',
    'Reconciliation Fixture Coffee',
    'Lenexa',
    '1 Fixture Way, Lenexa, KS 66215',
    'coffee_shop'
  ),
  (
    '6b633300-9999-4000-8000-000000000002',
    'Rollback Fixture Coffee',
    'Lenexa',
    '2 Fixture Way, Lenexa, KS 66215',
    'coffee_shop'
  );

insert into public.place_details (place_id)
values ('6b633300-9999-4000-8000-000000000001');

select ok(
  has_function_privilege('service_role', 'public.kc3_reconcile_google_place(jsonb)', 'execute'),
  'service role can execute reviewed reconciliation imports'
);

select ok(
  not has_function_privilege('anon', 'public.kc3_reconcile_google_place(jsonb)', 'execute'),
  'anonymous clients cannot execute reconciliation imports'
);

select lives_ok(
  $sql$
    select public.kc3_reconcile_google_place(
      $json${
        "googlePlaceId":"google-seed-reconciliation",
        "expectedPlaceId":"6b633300-9999-4000-8000-000000000001",
        "placeType":"coffee_shop",
        "fetchedAt":"2026-09-20T12:00:00Z",
        "provider":{
          "name":"Black Dog Coffeehouse",
          "address":"12815 W 87th St Pkwy, Lenexa, KS 66215",
          "addressComponents":[{"longText":"Lenexa","types":["locality"]}],
          "latitude":38.969,
          "longitude":-94.736,
          "businessStatus":"OPERATIONAL",
          "types":["coffee_shop"],
          "timeZone":"America/Chicago"
        },
        "canonical":{
          "latitude":38.969,
          "longitude":-94.736,
          "timeZone":"America/Chicago"
        }
      }$json$::jsonb
    )
  $sql$,
  'a reviewed provider identity attaches to an existing seed atomically'
);

select is(
  (
    select google_place_id
    from public.places
    where id = '6b633300-9999-4000-8000-000000000001'
  ),
  'google-seed-reconciliation',
  'the seed retains its KC3 identity and receives the stable provider identity'
);

select is(
  (
    select google_name
    from public.place_google_data
    where place_id = '6b633300-9999-4000-8000-000000000001'
  ),
  'Black Dog Coffeehouse',
  'the same transaction persists provider metadata on the seed'
);

select is(
  (
    select count(*)::integer
    from public.place_details
    where place_id = '6b633300-9999-4000-8000-000000000001'
      and outlets = 'unknown'
      and wifi = 'unknown'
      and work_suitability = 'unknown'
      and food_beverage = 'unknown'
      and last_verified_at is null
  ),
  1,
  'provider reconciliation preserves unknown KC3-owned suitability data'
);

select throws_ok(
  $sql$
    select public.kc3_reconcile_google_place(
      $json${
        "googlePlaceId":"google-rollback-reconciliation",
        "expectedPlaceId":"6b633300-9999-4000-8000-000000000002",
        "placeType":"coffee_shop",
        "fetchedAt":"2026-09-20T12:00:00Z",
        "provider":{"rawResponse":{"not":"allowed"}},
        "canonical":{}
      }$json$::jsonb
    )
  $sql$,
  '22023',
  'normalized fields contain unsupported values',
  'a rejected provider payload fails the reconciliation transaction'
);

select is(
  (
    select google_place_id
    from public.places
    where id = '6b633300-9999-4000-8000-000000000002'
  ),
  null,
  'a failed import rolls the provider identity attachment back'
);

select * from finish();

rollback;
