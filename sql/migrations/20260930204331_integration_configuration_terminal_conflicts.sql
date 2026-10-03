-- Business version conflicts are terminal; SQLSTATE 40001 means retryable serialization failure.
-- Preserve signatures, ownership, ACLs, transaction bodies and exact domain messages.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
do $terminal_configuration_conflicts$
declare
  target record;
  function_oid regprocedure;
  definition text;
  previous_raise text;
  corrected_raise text;
begin
  for target in select * from (values
    ('public.replace_integration_app_configuration(text,text,integer,jsonb,text[],bigint,text)', 'integration_app_configuration_version_conflict'),
    ('public.remove_integration_app_configuration(text,text,integer,bigint)', 'integration_app_configuration_version_conflict'),
    ('public.claim_integration_app_configuration_test(text,text,integer)', 'integration_app_configuration_version_conflict'),
    ('public.complete_integration_app_configuration_test(text,text,integer,text,text)', 'integration_app_configuration_test_conflict')
  ) as targets(signature, message)
  loop
    function_oid := pg_catalog.to_regprocedure(target.signature);
    if function_oid is null then
      raise exception using errcode = 'P0001', message = 'integration_terminal_conflict_owner_missing';
    end if;
    definition := pg_catalog.pg_get_functiondef(function_oid);
    previous_raise := pg_catalog.format('errcode = %L, message = %L', '40001', target.message);
    corrected_raise := pg_catalog.format('errcode = %L, message = %L', 'PT409', target.message);
    if (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, previous_raise, ''))) <> pg_catalog.length(previous_raise) then
      raise exception using errcode = 'P0001', message = 'integration_terminal_conflict_owner_drift';
    end if;
    execute pg_catalog.replace(definition, previous_raise, corrected_raise);
  end loop;
end;
$terminal_configuration_conflicts$;
notify pgrst, 'reload schema';
commit;
