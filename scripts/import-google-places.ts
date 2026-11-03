// Historical entry point retained only to fail before any provider request.
// The database also rejects the old write RPCs and Google-owned rows.
console.error(
  "Google Places ingestion is retired by KC3-37. Use reviewed Overture staging and publication.",
);
process.exitCode = 1;
