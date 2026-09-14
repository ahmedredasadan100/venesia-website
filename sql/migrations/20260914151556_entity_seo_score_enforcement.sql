-- ENFORCE only after the adopted application is deployed and a final catch-up
-- backfill verifies every row. Applying this before code activation would break
-- legacy writers. No scoring, source-data rewrite, or registry mutation occurs.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Block concurrent writes across the verification/trigger swap.
lock table public.topics, public.projects in share row exclusive mode;

do $preflight$
begin
  if to_regprocedure('public.check_entity_seo_score_write()') is null
     or to_regprocedure('public.invalidate_entity_seo_score_write()') is null
     or to_regprocedure('public.duplicate_project_admin_entry(bigint,jsonb)') is null
     or not exists (select 1 from pg_trigger where tgrelid = 'public.topics'::regclass
       and tgname = 'topics_entity_seo_score_transition' and tgenabled = 'O')
     or not exists (select 1 from pg_trigger where tgrelid = 'public.projects'::regclass
       and tgname = 'projects_entity_seo_score_transition' and tgenabled = 'O') then
    raise exception 'Entity SEO ENFORCE requires the EXPAND transition.';
  end if;
  if exists (select 1 from public.topics entity
       where seo_score is null or seo_score_version is distinct from 1
         or seo_score_input_hash is null
         or seo_score_input_hash is distinct from public.entity_seo_score_input_hash('topics', to_jsonb(entity)))
     or exists (select 1 from public.projects entity
       where seo_score is null or seo_score_version is distinct from 1
         or seo_score_input_hash is null
         or seo_score_input_hash is distinct from public.entity_seo_score_input_hash('projects', to_jsonb(entity))) then
    raise exception using errcode = '23514', message = 'Entity SEO ENFORCE blocked: unresolved or invalid persisted provenance.';
  end if;
end
$preflight$;

drop trigger topics_entity_seo_score_transition on public.topics;
drop trigger projects_entity_seo_score_transition on public.projects;
drop function public.invalidate_entity_seo_score_write();

create constraint trigger topics_entity_seo_score_write
after insert or update of content_type,title,excerpt,slug,content,image,image_alt,og_image,
  og_image_alt,seo_title,seo_description,seo_keywords,focus_keyword,faq,
  seo_score,seo_score_version,seo_score_input_hash on public.topics
deferrable initially deferred for each row execute function public.check_entity_seo_score_write();

create constraint trigger projects_entity_seo_score_write
after insert or update of arabic_name,general_description,overview_body,slug,hero_image,
  hero_image_alt,og_image,og_image_alt,seo_title,seo_description,seo_keywords,focus_keyword,
  seo_score,seo_score_version,seo_score_input_hash on public.projects
deferrable initially deferred for each row execute function public.check_entity_seo_score_write();

notify pgrst, 'reload schema';
commit;
