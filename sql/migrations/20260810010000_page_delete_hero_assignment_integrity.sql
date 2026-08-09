-- Page hard-delete Hero assignment integrity correction.
-- This is a surgical rewrite of the existing atomic owner. It does not add a
-- lifecycle, Trash behavior, or a new mutation capability.

begin;

do $migration$
declare
  v_definition text;
  v_next text;
  v_delete_branch text;
  v_branch_start integer;
  v_branch_end integer;
  v_old constant text := $old$    delete from public.pages where id = p_page_id;$old$;
  v_new constant text := $new$    delete from public.hero_assignments
    where target_type = 'page' and target_id = p_page_id;
    delete from public.pages where id = p_page_id;$new$;
begin
  select pg_get_functiondef(
    'public.mutate_page_composition(bigint,text,jsonb,bigint,text)'::regprocedure
  ) into v_definition;

  v_branch_start := strpos(
    v_definition,
    $needle$  elsif p_operation = 'delete_page' then$needle$
  );
  if v_branch_start = 0 then
    raise exception 'mutate_page_composition delete_page branch is missing';
  end if;

  v_delete_branch := substr(v_definition, v_branch_start);
  v_branch_end := strpos(
    v_delete_branch,
    $needle$  elsif p_operation = 'replace_hero_template' then$needle$
  );
  if v_branch_end = 0 then
    raise exception 'mutate_page_composition delete_page branch boundary drifted';
  end if;
  v_delete_branch := left(v_delete_branch, v_branch_end - 1);

  if strpos(v_delete_branch, v_old) = 0
     or strpos(v_delete_branch, 'delete from public.hero_assignments') > 0
     or (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'mutate_page_composition delete_page rewrite precondition drifted';
  end if;

  v_next := replace(v_definition, v_old, v_new);
  execute v_next;

  select pg_get_functiondef(
    'public.mutate_page_composition(bigint,text,jsonb,bigint,text)'::regprocedure
  ) into v_definition;
  v_branch_start := strpos(
    v_definition,
    $needle$  elsif p_operation = 'delete_page' then$needle$
  );
  v_delete_branch := substr(v_definition, v_branch_start);
  v_branch_end := strpos(
    v_delete_branch,
    $needle$  elsif p_operation = 'replace_hero_template' then$needle$
  );
  v_delete_branch := left(v_delete_branch, v_branch_end - 1);

  if strpos(v_delete_branch, v_new) = 0
     or strpos(v_delete_branch, 'delete from public.hero_templates') > 0 then
    raise exception 'mutate_page_composition delete_page Hero cleanup postcondition failed';
  end if;
end;
$migration$;

comment on function public.mutate_page_composition(bigint, text, jsonb, bigint, text) is
  'Atomic Page Composition owner, including page hard-delete cleanup of page-target Hero assignments.';

select pg_catalog.pg_notify('pgrst', 'reload schema');

commit;
