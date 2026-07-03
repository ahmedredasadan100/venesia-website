-- Feed Modules — Topics only (Phase 1)
-- Reusable feed widget templates + page assignments.
-- CMS stores query/display config only; items come from topics tables at runtime.

begin;

create table if not exists public.feed_module_templates (
  id            bigserial primary key,
  name          text not null,
  slug          text not null,
  description   text,
  status        text not null default 'draft'
                check (status in ('draft', 'published', 'unpublished', 'archived')),
  feed_type     text not null
                check (feed_type in ('latest', 'popular', 'categories', 'series')),
  config        jsonb not null default '{}'::jsonb,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint feed_module_templates_slug_unique unique (slug)
);

create index if not exists feed_module_templates_status_idx
  on public.feed_module_templates (status);

create index if not exists feed_module_templates_feed_type_idx
  on public.feed_module_templates (feed_type);

create table if not exists public.page_feed_module_assignments (
  id            bigserial primary key,
  page_id       bigint not null references public.pages (id) on delete cascade,
  template_id   bigint not null references public.feed_module_templates (id) on delete cascade,
  slot          text not null default 'sidebar',
  sort_order    integer not null default 0,
  is_visible    boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint page_feed_module_assignments_unique unique (page_id, template_id)
);

create index if not exists page_feed_module_assignments_page_idx
  on public.page_feed_module_assignments (page_id, slot, sort_order);

-- ---------------------------------------------------------------------------
-- Topics sidebar feed templates (matches current hardcoded sidebar labels/order)
-- ---------------------------------------------------------------------------
insert into public.feed_module_templates (name, slug, description, status, feed_type, config, sort_order)
values
  (
    'Topics — Categories',
    'topics-feed-categories',
    'تصنيفات موضوعات تهمك',
    'published',
    'categories',
    $json${
      "presentation": {
        "title": "مواضيع تهمك",
        "eyebrow": "Categories",
        "linkText": null,
        "showImage": true,
        "showDate": true,
        "showExcerpt": false,
        "emptyBehavior": "hide"
      },
      "query": {
        "limit": 20,
        "categorySlug": null,
        "seriesSlug": null
      }
    }$json$::jsonb,
    10
  ),
  (
    'Topics — Latest',
    'topics-feed-latest',
    'أحدث الموضوعات',
    'published',
    'latest',
    $json${
      "presentation": {
        "title": "أحدث الموضوعات",
        "eyebrow": null,
        "linkText": null,
        "showImage": true,
        "showDate": true,
        "showExcerpt": false,
        "emptyBehavior": "hide"
      },
      "query": {
        "limit": 3,
        "categorySlug": null,
        "seriesSlug": null
      }
    }$json$::jsonb,
    20
  ),
  (
    'Topics — Popular',
    'topics-feed-popular',
    'الأكثر قراءة',
    'published',
    'popular',
    $json${
      "presentation": {
        "title": "الأكثر قراءة",
        "eyebrow": null,
        "linkText": null,
        "showImage": true,
        "showDate": false,
        "showExcerpt": false,
        "emptyBehavior": "hide"
      },
      "query": {
        "limit": 3,
        "categorySlug": null,
        "seriesSlug": null
      }
    }$json$::jsonb,
    30
  ),
  (
    'Topics — Series',
    'topics-feed-series',
    'سلاسل المحتوى',
    'published',
    'series',
    $json${
      "presentation": {
        "title": "سلاسل المحتوى",
        "eyebrow": "Series",
        "linkText": "عرض كل الموضوعات",
        "showImage": true,
        "showDate": false,
        "showExcerpt": false,
        "emptyBehavior": "hide"
      },
      "query": {
        "limit": 20,
        "categorySlug": null,
        "seriesSlug": null
      }
    }$json$::jsonb,
    40
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status,
  feed_type = excluded.feed_type,
  config = excluded.config,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.page_feed_module_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'sidebar', t.sort_order, true
from public.pages p
cross join public.feed_module_templates t
where p.slug = 'topics'
  and t.slug in (
    'topics-feed-categories',
    'topics-feed-latest',
    'topics-feed-popular',
    'topics-feed-series'
  )
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = true,
  updated_at = now();

commit;
