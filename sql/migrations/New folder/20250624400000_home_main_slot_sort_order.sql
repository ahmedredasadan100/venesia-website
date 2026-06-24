-- Product-approved home main slot sort_order (single source of truth for section order).
-- home-story=10, home-projects=20, home-trust=30, home-contact=40
-- Idempotent: safe to re-run.

begin;

update public.page_content_block_assignments a
set sort_order = v.sort_order, updated_at = now()
from public.pages p
cross join (
  values
    ('home-story', 10),
    ('home-projects', 20),
    ('home-trust', 30),
    ('home-contact', 40)
) as v(slug, sort_order)
join public.content_block_templates t on t.slug = v.slug
where a.page_id = p.id
  and a.template_id = t.id
  and p.slug = 'home';

commit;
