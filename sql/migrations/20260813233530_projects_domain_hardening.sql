-- PROJECTS DOMAIN HARDENING
--
-- Project identity is owned exclusively by public.projects.id. The Project
-- code remains a required, formatted, user-visible label; it is not an
-- identity key, relationship key, or uniqueness contract.

begin;

do $project_identity_precondition$
declare
  v_project_id_attribute smallint;
  v_primary_key_columns smallint[];
begin
  select attribute.attnum
    into v_project_id_attribute
    from pg_catalog.pg_attribute attribute
   where attribute.attrelid = 'public.projects'::regclass
     and attribute.attname = 'id'
     and not attribute.attisdropped;

  select constraint_record.conkey
    into v_primary_key_columns
    from pg_catalog.pg_constraint constraint_record
   where constraint_record.conrelid = 'public.projects'::regclass
     and constraint_record.contype = 'p';

  if v_project_id_attribute is null
     or v_primary_key_columns is distinct from array[v_project_id_attribute]::smallint[] then
    raise exception using
      errcode = 'P0001',
      message = 'Projects Domain hardening refused: public.projects.id is not the sole primary key.';
  end if;

  if exists (
    select 1
      from pg_catalog.pg_constraint relationship
      cross join lateral unnest(relationship.confkey) referenced_column(attnum)
      join pg_catalog.pg_attribute attribute
        on attribute.attrelid = relationship.confrelid
       and attribute.attnum = referenced_column.attnum
     where relationship.contype = 'f'
       and relationship.confrelid = 'public.projects'::regclass
       and attribute.attname <> 'id'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Projects Domain hardening refused: a relationship targets a Project column other than project_id.';
  end if;

  if exists (
    select 1
      from pg_catalog.pg_attribute attribute
      join pg_catalog.pg_class relation on relation.oid = attribute.attrelid
      join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
     where namespace.nspname = 'public'
       and relation.relname <> 'projects'
       and relation.relkind in ('r', 'p')
       and attribute.attname = 'project_code'
       and not attribute.attisdropped
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Projects Domain hardening refused: a Project Domain relation stores project_code.';
  end if;
end
$project_identity_precondition$;

-- This was the only second-identity contract. No CASCADE is used: an
-- unexpected dependency fails the migration instead of being removed.
drop index if exists public.projects_code_unique_idx;

comment on column public.projects.id is
  'Canonical and sole Project identity. All Project Domain relationships use project_id.';
comment on column public.projects.code is
  'Required user-visible Project label; not an identity, relationship, or uniqueness key.';
comment on function public.duplicate_project_admin_entry(bigint) is
  'Duplicates a Project aggregate by project_id; the copy receives a derived display code and draft visibility.';

do $project_identity_postcondition$
begin
  if exists (
    select 1
      from pg_catalog.pg_index index_record
     where index_record.indrelid = 'public.projects'::regclass
       and index_record.indisunique
       and pg_catalog.pg_get_indexdef(index_record.indexrelid) ~* '\mcode\M'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Projects Domain hardening failed: Project code still participates in a unique index.';
  end if;
end
$project_identity_postcondition$;

commit;
