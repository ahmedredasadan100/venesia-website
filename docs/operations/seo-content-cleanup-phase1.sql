-- SEO Content Cleanup & Query Ownership — Phase 1
-- Reviewed one-time data operation; NOT a migration or runtime registry.
-- Execute only after the runbook's exact-head CI and disposable rehearsal gates.
-- Target: pmqsfqvvekrlujqgurcu. Data/SEO text/media are preserved.
begin;
set local timezone = 'UTC';
set local lock_timeout = '5s';
set local statement_timeout = '30s';
lock table public.topics, public.pages, public.projects, public.url_redirects, public.menu_items, public.hero_templates, public.cta_block_templates, public.content_block_templates, public.cards_block_templates, public.breadcrumb_block_templates, public.featured_module_templates, public.feed_module_templates, public.media_hub_module_templates, public.media_sidebar_module_templates, public.page_featured_module_assignments, public.page_feed_module_assignments, public.page_media_hub_module_assignments, public.page_media_sidebar_module_assignments, public.topic_categories, public.topic_series, public.page_breadcrumb_block_assignments, public.page_cards_block_assignments, public.page_content_block_assignments, public.page_cta_block_assignments, public.page_composition_assignments, public.site_settings in share row exclusive mode;
create temporary table cleanup_topics_before on commit drop as select * from public.topics;
do $cleanup$
declare
  result jsonb;
  redirect_id bigint;
  target_ids bigint[] := array[1588,1592,1624,1625,1626,1627,1628,1629,1630,1632,1633,1634,1635,1636,1639,1640,1641,1642,1643,1644,1645,1646,1647,1648,1649,1650,1651,1652,1653,1654,1655,1656,1657,1658,1659,1660,1661,1663];
begin
  if not exists(select 1 from public.admin_users where id=6 and username='ahmed' and is_active) then
    raise exception 'cleanup_actor_changed';
  end if;
  if (select md5(coalesce(jsonb_agg(to_jsonb(t)-'views_count' order by t.id),'[]'::jsonb)::text) from public.topics t) is distinct from '59beb1eb5b27ca22e410518578ba219a' then
    raise exception 'cleanup_drift_topics';
  end if;
  if (select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb)::text) from public.pages t) is distinct from 'dfc9248149ac28145108975197218f44' then
    raise exception 'cleanup_drift_pages';
  end if;
  if (select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb)::text) from public.projects t) is distinct from '87151c1ba441441c4dbf38aa76f00dd9' then
    raise exception 'cleanup_drift_projects';
  end if;
  if (select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb)::text) from public.url_redirects t) is distinct from 'd751713988987e9331980363e24189ce' then
    raise exception 'cleanup_drift_url_redirects';
  end if;
  if (select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb)::text) from public.menu_items t) is distinct from '169693d56e44aade59927cd3a53d3a5d' then
    raise exception 'cleanup_drift_menu_items';
  end if;
  if (select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb)::text) from public.hero_templates t) is distinct from 'e535e8e8c6b5b38dc0f9a24e54e7355d' then
    raise exception 'cleanup_drift_hero_templates';
  end if;
  if (select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb)::text) from public.cta_block_templates t) is distinct from '68de2dac11a292f4e6e74611c9fd2eb6' then
    raise exception 'cleanup_drift_cta_block_templates';
  end if;
  if (select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb)::text) from public.content_block_templates t) is distinct from 'f8dd4c8f3f372f27f64254d8857c3316' then
    raise exception 'cleanup_drift_content_block_templates';
  end if;
  if (select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb)::text) from public.cards_block_templates t) is distinct from '172617584dabefe4baefea95a9650dfb' then
    raise exception 'cleanup_drift_cards_block_templates';
  end if;
  if (select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb)::text) from public.breadcrumb_block_templates t) is distinct from 'a04105b8d549232d393a5f6be12e0d34' then
    raise exception 'cleanup_drift_breadcrumb_block_templates';
  end if;
  if (select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb)::text) from public.featured_module_templates t) is distinct from '442c10416c2a9f196730b32f8bc58f65' then
    raise exception 'cleanup_drift_featured_module_templates';
  end if;
  if (select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb)::text) from public.feed_module_templates t) is distinct from 'f0469efb16cfde7e9476463f30adbfe9' then
    raise exception 'cleanup_drift_feed_module_templates';
  end if;
  if (select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb)::text) from public.media_hub_module_templates t) is distinct from '5acc60abe2b8b4bc6ab1f34a39ac359a' then
    raise exception 'cleanup_drift_media_hub_module_templates';
  end if;
  if (select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb)::text) from public.media_sidebar_module_templates t) is distinct from 'e760cd42865a719e70455c988db948b4' then
    raise exception 'cleanup_drift_media_sidebar_module_templates';
  end if;
  if (select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb)::text) from public.page_featured_module_assignments t) is distinct from '03444d0fc34f724a9a31edbfeed09b5d' then
    raise exception 'cleanup_drift_page_featured_module_assignments';
  end if;
  if (select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb)::text) from public.page_feed_module_assignments t) is distinct from '7507cfaa91704e4003ef85c98c7d3345' then
    raise exception 'cleanup_drift_page_feed_module_assignments';
  end if;
  if (select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb)::text) from public.page_media_hub_module_assignments t) is distinct from '7934d0b83178049724410bd888457499' then
    raise exception 'cleanup_drift_page_media_hub_module_assignments';
  end if;
  if (select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb)::text) from public.page_media_sidebar_module_assignments t) is distinct from '98c6103ef9fb9d3ceeb752501be13df2' then
    raise exception 'cleanup_drift_page_media_sidebar_module_assignments';
  end if;
  if (select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb)::text) from public.topic_categories t) is distinct from '7c54cb72277268a682d277d1f963bfb5' then
    raise exception 'cleanup_drift_topic_categories';
  end if;
  if (select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb)::text) from public.topic_series t) is distinct from '986d90a7b8652e52ded18637071f68fc' then
    raise exception 'cleanup_drift_topic_series';
  end if;
  if (select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb)::text) from public.page_breadcrumb_block_assignments t) is distinct from '05069dd7cc4ba49a8946dd568bc62d47' then
    raise exception 'cleanup_drift_page_breadcrumb_block_assignments';
  end if;
  if (select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb)::text) from public.page_cards_block_assignments t) is distinct from 'a643f30ac6cf070c8184cf1d78e1f914' then
    raise exception 'cleanup_drift_page_cards_block_assignments';
  end if;
  if (select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb)::text) from public.page_content_block_assignments t) is distinct from 'bb489183a84bb25e83d85f3257a3b9a3' then
    raise exception 'cleanup_drift_page_content_block_assignments';
  end if;
  if (select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb)::text) from public.page_cta_block_assignments t) is distinct from 'ac2946d1309ee84a6eb6b24ae8201209' then
    raise exception 'cleanup_drift_page_cta_block_assignments';
  end if;
  if (select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id, to_jsonb(t)::text),'[]'::jsonb)::text) from public.page_composition_assignments t) is distinct from 'f70a5d21a4f6ee5fb0cb32b8ffe9d081' then
    raise exception 'cleanup_drift_page_composition_assignments';
  end if;
  if (select md5(coalesce(jsonb_agg(to_jsonb(t) order by t.key),'[]'::jsonb)::text) from public.site_settings t where t.key in ('footer.slots','footer.contact_items')) is distinct from '4fe5b2f445f79619f00d72346bab841a' then
    raise exception 'cleanup_drift_site_settings';
  end if;
  if exists(select 1 from public.topics a cross join public.topics owner
    where a.id in (1588,1592) and owner.id=1521 and
      (replace(a.content,chr(13),'') is distinct from replace(owner.content,chr(13),'')
       or a.faq is distinct from owner.faq or a.excerpt is distinct from owner.excerpt
       or a.canonical_url is distinct from owner.canonical_url)) then
    raise exception 'cleanup_alias_content_changed';
  end if;
  if (select count(*) from public.topics where id=any(target_ids) and status='published' and deleted_at is null) <> 38 then
    raise exception 'cleanup_membership_changed';
  end if;
  result := public.admin_mutate_topics_batch_atomically(
    p_actor_id=>6, p_action=>'unpublish', p_topic_ids=>target_ids,
    p_command_id=>'25a5d19e-e7e1-4e50-8cc7-c0d58d05beae'::uuid);
  if result->>'ok' is distinct from 'true' or result->'changedIds' is distinct from to_jsonb(target_ids) then
    raise exception 'cleanup_unpublish_rejected';
  end if;
  insert into public.url_redirects(source_path,destination_path,redirect_type,status,note)
    values('/topics/akhr-aselh-qbl-shra-shqh-fy-byt-alwtn-dqaeq-qd-twfr-snwatbsybsybysb','/topics/final-faq-before-buy-beit-al-watan',301,'active','SEO cleanup Phase 1: exact duplicate; retained unpublished for recovery') returning id into redirect_id;
  insert into public.admin_audit_logs(actor_admin_user_id,actor_username,action,entity_type,entity_id,entity_label,metadata)
    values(6,'ahmed','redirect.create','redirect',redirect_id,'/topics/akhr-aselh-qbl-shra-shqh-fy-byt-alwtn-dqaeq-qd-twfr-snwatbsybsybysb',
      jsonb_build_object('source_path','/topics/akhr-aselh-qbl-shra-shqh-fy-byt-alwtn-dqaeq-qd-twfr-snwatbsybsybysb','destination_path','/topics/final-faq-before-buy-beit-al-watan','redirect_type',301,'operation','seo-content-cleanup-phase1'));
  insert into public.url_redirects(source_path,destination_path,redirect_type,status,note)
    values('/topics/nskhh-gdydh-tgrbh1','/topics/final-faq-before-buy-beit-al-watan',301,'active','SEO cleanup Phase 1: exact duplicate; retained unpublished for recovery') returning id into redirect_id;
  insert into public.admin_audit_logs(actor_admin_user_id,actor_username,action,entity_type,entity_id,entity_label,metadata)
    values(6,'ahmed','redirect.create','redirect',redirect_id,'/topics/nskhh-gdydh-tgrbh1',
      jsonb_build_object('source_path','/topics/nskhh-gdydh-tgrbh1','destination_path','/topics/final-faq-before-buy-beit-al-watan','redirect_type',301,'operation','seo-content-cleanup-phase1'));
  if exists(select 1 from public.topics t join cleanup_topics_before b using(id)
    where (to_jsonb(t)-array['status','updated_at','updated_by','views_count']) is distinct from
          (to_jsonb(b)-array['status','updated_at','updated_by','views_count'])
      or (t.id<>all(target_ids) and (t.status,t.updated_at,t.updated_by) is distinct from (b.status,b.updated_at,b.updated_by))
      or (t.id=any(target_ids) and (t.status<>'unpublished' or t.deleted_at is not null))) then
    raise exception 'cleanup_preservation_failed';
  end if;
  if (select count(*) from public.topics)<>(select count(*) from cleanup_topics_before) then
    raise exception 'cleanup_row_loss';
  end if;
end;
$cleanup$;
commit;
-- Domain changes are committed. Retry ONLY this idempotent invalidation if it fails.
select public.advance_public_cache_generation();
