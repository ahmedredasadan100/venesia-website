-- Topics Listing Presentation Module — Phase 1.
-- Reuses the existing Content Page Block tables and assignment contract.
-- The page remains the sole Topics read owner; this config controls presentation only.

begin;

insert into public.content_block_templates (
  name,
  slug,
  description,
  variant,
  style_preset,
  status,
  config,
  sort_order
)
values (
  'Topics — Listing',
  'topics-listing',
  'عرض الموضوعات التي ترسلها صفحة مركز المعرفة',
  'topics-listing',
  'premium-dark',
  'published',
  $json${
    "presentation": "list",
    "itemsPerRow": 3,
    "itemLimit": 6
  }$json$::jsonb,
  20
)
on conflict (slug) do nothing;

do $seed_topics_listing_assignment$
declare
  v_page_id bigint;
  v_template_id bigint;
begin
  select p.id, t.id
  into v_page_id, v_template_id
  from public.pages p
  join public.content_block_templates t on t.slug = 'topics-listing'
  where p.slug = 'topics';

  if v_page_id is not null and v_template_id is not null then
    perform public.mutate_page_composition(
      v_page_id,
      'sync_template_pages',
      jsonb_build_object(
        'kind', 'content',
        'template_id', v_template_id,
        'default_slot', 'main',
        'page_ids', jsonb_build_array(v_page_id)
      ),
      null,
      'system:migration:20260828114621_topics_listing_presentation_phase_1'
    );
  end if;
end;
$seed_topics_listing_assignment$;

commit;
