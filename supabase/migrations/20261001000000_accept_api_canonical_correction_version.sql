-- Supabase serializes timestamptz values as ISO 8601. Normalize that API value
-- to PostgreSQL's timestamptz text form before the original correction function
-- performs its exact optimistic-concurrency comparison.

grant kc3_canonical_correction_operator to postgres;

alter function public.kc3_correct_canonical_place(uuid, jsonb)
rename to kc3_correct_canonical_place_with_database_version;

revoke execute on function
  public.kc3_correct_canonical_place_with_database_version(uuid, jsonb)
from public, anon, authenticated, service_role;

grant create on schema public to kc3_canonical_correction_operator;

create function public.kc3_correct_canonical_place(
  target_place_id uuid,
  payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_payload jsonb := payload;
  expected_updated_at timestamptz;
begin
  if jsonb_typeof(payload) = 'object'
    and jsonb_typeof(payload -> 'expectedUpdatedAt') = 'string'
  then
    begin
      expected_updated_at := (payload ->> 'expectedUpdatedAt')::timestamptz;
    exception
      when invalid_datetime_format or datetime_field_overflow then
        raise exception using
          errcode = '22023',
          message = 'expected canonical place version is invalid';
    end;

    normalized_payload := jsonb_set(
      payload,
      '{expectedUpdatedAt}',
      to_jsonb(expected_updated_at::text)
    );
  end if;

  return public.kc3_correct_canonical_place_with_database_version(
    target_place_id,
    normalized_payload
  );
end;
$$;

comment on function public.kc3_correct_canonical_place(uuid, jsonb) is
  'Server-only atomic canonical correction accepting the Supabase ISO timestamp version and retaining required immutable evidence.';

revoke execute on function public.kc3_correct_canonical_place(uuid, jsonb)
from public, anon, authenticated;
alter function public.kc3_correct_canonical_place(uuid, jsonb)
owner to kc3_canonical_correction_operator;
grant execute on function public.kc3_correct_canonical_place(uuid, jsonb)
to service_role;

revoke create on schema public from kc3_canonical_correction_operator;
revoke kc3_canonical_correction_operator from postgres;
