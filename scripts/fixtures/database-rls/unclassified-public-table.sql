-- QA-only negative security-contract fixture. Not an application migration.
-- The canonical role-verification helper always executes the final ROLLBACK.
begin;
create table public.qa_rls_unclassified_probe (
  id integer not null
);
-- QA_RLS_STAGE: ENABLE
alter table public.qa_rls_unclassified_probe enable row level security;
-- QA_RLS_STAGE: ROLLBACK
rollback;
