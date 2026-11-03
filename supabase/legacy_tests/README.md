# Historical Google-backed database tests

These SQL tests describe the pre-KC3-37 Google import, public-read, and
operator contracts. They are retained for audit/history and are intentionally
outside `supabase/tests/`, because those operations are retired by
`20261101000000_reviewed_overture_publication.sql`. The active suite keeps the
base schema/place/hours/seed tests and adds current security, staging,
publication, stable-ID, attribution, and protected-data checks. Do not restore
these historical tests to the active gate without revising their expectations
for licensed-source publication.
