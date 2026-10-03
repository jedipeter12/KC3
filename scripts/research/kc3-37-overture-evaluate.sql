-- Research only: DuckDB SQL, never a Supabase migration or production import.
-- Input: regional_places table extracted as documented in KC3_37_SOURCE_EVALUATION.md.
-- Uses primary taxonomy and first postal locality, not municipal boundaries.
-- Thresholds are sensitivity probes, not approved publication rules.
CREATE OR REPLACE TEMP VIEW candidates AS
SELECT *, lower(trim(addresses[1].locality)) AS city,
  CASE taxonomy.primary
    WHEN 'coffee_shop' THEN 'coffee_shop'
    WHEN 'cafe' THEN 'cafe'
    WHEN 'bubble_tea_shop' THEN 'boba_tea'
    WHEN 'tea_room' THEN 'boba_tea'
    WHEN 'library' THEN 'library'
    WHEN 'coworking_space' THEN 'coworking'
    WHEN 'park' THEN 'park'
  END AS kc3_category
FROM regional_places
WHERE lower(trim(addresses[1].locality)) IN ('lenexa', 'overland park', 'olathe')
  AND taxonomy.primary IN ('coffee_shop', 'cafe', 'bubble_tea_shop',
    'tea_room', 'library', 'coworking_space', 'park');

SELECT count(*) AS regional_records,
  count(*) FILTER (WHERE lower(trim(addresses[1].locality))
    IN ('lenexa', 'overland park', 'olathe')) AS target_locality_records
FROM regional_places;

SELECT city, kc3_category, count(*) AS raw_candidates,
  count(*) FILTER (WHERE operating_status = 'open' AND confidence >= 0.75)
    AS open_confidence_075,
  count(*) FILTER (WHERE operating_status = 'open' AND confidence >= 0.95)
    AS open_confidence_095
FROM candidates GROUP BY city, kc3_category ORDER BY city, kc3_category;

SELECT count(*) AS candidates, count(DISTINCT id) AS unique_ids,
  count(*) FILTER (WHERE coalesce(trim(name), '') = '') AS missing_names,
  count(*) FILTER (WHERE coalesce(trim(addresses[1].freeform), '') = '') AS missing_streets,
  count(*) FILTER (WHERE coalesce(trim(addresses[1].postcode), '') = '') AS missing_postcodes,
  count(*) FILTER (WHERE websites IS NOT NULL AND len(websites) > 0) AS with_websites,
  count(*) FILTER (WHERE operating_status = 'open' AND confidence >= 0.75) AS shortlisted,
  count(*) FILTER (WHERE operating_status = 'open' AND confidence >= 0.95)
    AS shortlisted_095,
  count(*) FILTER (WHERE operating_status = 'open' AND confidence >= 0.75
    AND coalesce(trim(addresses[1].freeform), '') = '') AS shortlisted_missing_streets
FROM candidates;

SELECT operating_status, count(*) AS records FROM candidates GROUP BY 1 ORDER BY 1;

SELECT city,
  regexp_replace(lower(name), '[^a-z0-9]', '', 'g') AS normalized_name,
  regexp_replace(lower(addresses[1].freeform), '[^a-z0-9]', '', 'g') AS normalized_street,
  count(*) AS records
FROM candidates GROUP BY 1, 2, 3 HAVING count(*) > 1 ORDER BY 1, 2, 3;

SELECT source.dataset, source.license, count(DISTINCT id) AS contributing_records,
  min(source.update_time) AS oldest_metadata_update,
  max(source.update_time) AS newest_metadata_update
FROM candidates, unnest(sources) AS entry(source)
GROUP BY 1, 2 ORDER BY 1, 2;

-- Wider region and all categories deliberately used for seed recall inspection:
-- misclassified or older locations must not disappear behind category filters.
SELECT id, name, addresses[1].locality AS city, addresses[1].freeform AS street,
  taxonomy.primary AS category, confidence, operating_status
FROM regional_places
WHERE regexp_matches(lower(name),
  'black dog|maps coffee|city center library|black hoof|sar.ko.par|blue valley library|central resource library|oak park library|homer|pilgrim coffee|downtown library|indian creek library|sweet tee|apogee|black bob park')
  OR (taxonomy.primary = 'library' AND addresses[1].freeform IN
    ('8778 Penrose Ln', '9000 W 151st St', '9875 W 87th St',
     '9500 Bluejacket Dr', '260 E Santa Fe St'))
ORDER BY lower(name), street;
