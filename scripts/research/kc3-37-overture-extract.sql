-- Research only: DuckDB 1.5.6, standalone scratch database; no Supabase writes.
-- Create the extension directory first; install httpfs there before this query.
SET extension_directory='/private/tmp/kc3-37-sourcing/extensions';
LOAD httpfs;
SET s3_region='us-west-2';
SET threads=4;
SET memory_limit='1GB';
CREATE TABLE regional_places AS
SELECT id, names.primary AS name, addresses, basic_category, taxonomy,
  confidence, operating_status, websites, sources,
  bbox.xmin AS longitude, bbox.ymin AS latitude
FROM read_parquet(
  's3://overturemaps-us-west-2/release/2026-09-23.1/theme=places/type=place/*',
  hive_partitioning=true)
WHERE bbox.xmin BETWEEN -95.02 AND -94.58
  AND bbox.ymin BETWEEN 38.68 AND 39.08;
