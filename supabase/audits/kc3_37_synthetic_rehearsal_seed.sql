-- Run only in the disposable KC3_37_Synthetic_Rehearsal project.
begin;
insert into public.places (
  id, name, city, address, place_type, status, latitude, longitude,
  time_zone, address_precision, updated_at
) values (
  '11111111-1111-4111-8111-111111111111', 'Synthetic Old Cafe',
  'Lenexa', '1 Fixture Way', 'cafe', 'active', 38.9, -94.7,
  'America/Chicago', 'unknown', '2026-10-01T00:00:00Z'
);
insert into public.place_details (place_id, outlets, bathroom_available)
values ('11111111-1111-4111-8111-111111111111', 'many', false);
insert into public.place_hours (
  id, place_id, day_of_week, open_time, close_time, source, source_observed_at
) values (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111', 0, '09:00', '17:00', 'kc3',
  '2026-10-01T00:00:00Z'
);
insert into public.place_overrides (
  id, place_id, override_type, effective_start_date, override_value,
  source_observed_at
) values (
  '33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111', 'synthetic.v1',
  '2026-10-01', '{"v":0}', '2026-10-01T00:00:00Z'
);
insert into public.place_canonical_corrections (
  id, place_id, before_values, after_values, source_url,
  source_observed_on, correction_notes
) values (
  '44444444-4444-4444-8444-444444444444',
  '11111111-1111-4111-8111-111111111111',
  '{"name":"Synthetic Earlier Cafe"}', '{"name":"Synthetic Old Cafe"}',
  'https://example.org/synthetic-evidence', '2026-10-01',
  'Synthetic fixture correction.'
);
commit;
