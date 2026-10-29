-- Run only in the disposable KC3_37_Synthetic_Rehearsal project.
-- This selects complete protected rows, including nulls and timestamps.
select jsonb_build_object(
  'schemaVersion', 1,
  'places', coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'updatedAt', p.updated_at,
    'identity', jsonb_build_object(
      'name', p.name, 'city', p.city, 'address', p.address,
      'postcode', null, 'website', null, 'placeType', p.place_type,
      'addressPrecision', p.address_precision, 'latitude', p.latitude,
      'longitude', p.longitude, 'timeZone', p.time_zone, 'status', p.status
    ),
    'movedToPlaceId', p.moved_to_place_id,
    'protected', jsonb_build_object(
      'details', coalesce((select jsonb_agg(to_jsonb(d) order by d.place_id)
        from public.place_details d where d.place_id = p.id), '[]'::jsonb),
      'kc3Hours', coalesce((select jsonb_agg(to_jsonb(h) order by h.id)
        from public.place_hours h where h.place_id = p.id and h.source = 'kc3'), '[]'::jsonb),
      'overrides', coalesce((select jsonb_agg(to_jsonb(o) order by o.id)
        from public.place_overrides o where o.place_id = p.id), '[]'::jsonb),
      'correctionEvidence', coalesce((select jsonb_agg(to_jsonb(c) order by c.id)
        from public.place_canonical_corrections c where c.place_id = p.id), '[]'::jsonb)
    )
  ) order by p.id), '[]'::jsonb)
) from public.places p;
