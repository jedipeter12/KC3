-- Keep the private JSON staging boundary aligned with the workbook compiler.
-- Earlier reviewed batches without ruleType remain weekly schedules.
create function public.kc3_valid_overture_hours_rules(records jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select not exists (
    select 1
    from jsonb_array_elements(records) as entries(record)
    where coalesce(entries.record #>> '{hours,ruleType}', 'weekly')
        not in ('weekly', 'dawn_to_dusk')
      or (
        entries.record #>> '{hours,ruleType}' = 'dawn_to_dusk'
        and (
          entries.record #>> '{identity,placeType}' is distinct from 'park'
          or jsonb_array_length(entries.record #> '{hours,periods}') <> 7
          or exists (
            select 1
            from jsonb_array_elements(entries.record #> '{hours,periods}')
              as periods(period)
            where periods.period -> 'isClosed' is distinct from 'true'::jsonb
              or periods.period -> 'openTime' is distinct from 'null'::jsonb
              or periods.period -> 'closeTime' is distinct from 'null'::jsonb
              or periods.period -> 'closesNextDay' is distinct from 'false'::jsonb
          )
        )
      )
  );
$$;

revoke all on function public.kc3_valid_overture_hours_rules(jsonb)
from public, anon, authenticated, service_role;
grant execute on function public.kc3_valid_overture_hours_rules(jsonb)
to kc3_overture_review_importer;
alter table public.overture_review_batches
  add constraint overture_review_hours_rule_valid
  check (public.kc3_valid_overture_hours_rules(records));
