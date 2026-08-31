-- Search Platform Module.
-- Reuses Content Page Block persistence and Page Composition assignments.
-- Public Content Read remains the sole results/filter read owner.
-- This migration creates no Search runtime, Search engine, table, navigation,
-- footer, or Page Composition position/contract.

begin;

insert into public.pages (
  title,
  slug,
  path,
  page_type,
  status,
  sort_order,
  seo_title,
  seo_description,
  robots_index,
  robots_follow
)
values (
  'البحث',
  'search',
  '/search',
  'static',
  'published',
  70,
  'البحث في محتوى فينيسيا',
  'ابحث في المقالات والأخبار والبيانات الصحفية وتحديثات التنفيذ والمواد المرئية.',
  false,
  true
)
on conflict (path) do nothing;

do $assert_search_page_identity$
begin
  if not exists (
    select 1
    from public.pages
    where slug = 'search' and path = '/search'
  ) then
    raise exception 'Search Platform refused: /search identity conflicts with an existing page';
  end if;
end;
$assert_search_page_identity$;

insert into public.hero_templates (
  name,
  slug,
  description,
  section_key,
  variant,
  style_preset,
  source_type,
  limit_count,
  is_visible,
  status,
  sort_order,
  config
)
values (
  'Hero — Search',
  'hero-search',
  'Hero for the CMS-managed /search page',
  'hero',
  'internal-page',
  'cinematic-gold',
  'manual',
  1,
  true,
  'published',
  70,
  $json${
    "title": "البحث",
    "eyebrow": "Search",
    "subtitle": "ابحث في محتوى فينيسيا من مكان واحد.",
    "description": "المقالات والأخبار والبيانات الصحفية وتحديثات التنفيذ والمواد المرئية.",
    "images": ["/images/venesia-5.png"],
    "mobileImages": [],
    "showEyebrow": true,
    "showTitle": true,
    "showSubtitle": true,
    "showDescription": true,
    "showHighlight": false,
    "showCta": false,
    "eyebrowBold": false,
    "titleBold": true,
    "subtitleBold": false,
    "descriptionAlignment": "right",
    "eyebrowAlignment": "right",
    "titleAlignment": "right",
    "subtitleAlignment": "right",
    "imageComposition": "cover-upper",
    "heroElementOrder": ["eyebrow", "title", "highlight", "subtitle", "description", "cta"]
  }$json$::jsonb
)
on conflict (slug) do nothing;

insert into public.breadcrumb_block_templates (
  name,
  slug,
  description,
  variant,
  status,
  config,
  sort_order
)
values (
  'Breadcrumb — Search',
  'breadcrumb-search',
  'Breadcrumb for the CMS-managed /search page',
  'hero-inline',
  'published',
  '{"source":"navigation","showHome":true,"manualItems":[]}'::jsonb,
  70
)
on conflict (slug) do nothing;

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
values
  (
    'Search Platform — Results',
    'search-platform',
    'Canonical full Search Platform results module for /search',
    'search-platform',
    'premium-dark',
    'published',
    $json${
      "title": "ابحث في محتوى فينيسيا",
      "description": "اكتشف المقالات والأخبار والبيانات الصحفية وتحديثات التنفيذ والمواد المرئية من مكان واحد.",
      "placeholder": "اكتب كلمة البحث...",
      "helpText": "ابحث بالعنوان أو الملخص أو الرابط أو التصنيف أو السلسلة.",
      "scope": "all",
      "contentTypes": ["article", "news", "press", "site_update", "video", "gallery"],
      "resultLimit": 12,
      "presentation": "full-grid",
      "filters": ["content-type", "category", "series"],
      "defaultSort": "newest"
    }$json$::jsonb,
    70
  ),
  (
    'Search — Topics',
    'topics-search',
    'Compact Search Platform launcher scoped to articles',
    'search-platform',
    'premium-dark',
    'published',
    $json${
      "title": "ابحث في الموضوعات",
      "description": "انتقل إلى صفحة البحث الموحدة لاستكشاف موضوعات مركز المعرفة.",
      "placeholder": "اكتب كلمة البحث...",
      "helpText": "البحث في المقالات والعناوين والتصنيفات والسلاسل.",
      "scope": "selected",
      "contentTypes": ["article"],
      "resultLimit": 12,
      "presentation": "compact",
      "filters": ["category", "series"],
      "defaultSort": "newest"
    }$json$::jsonb,
    71
  ),
  (
    'Search — Media News',
    'media-news-search',
    'Compact Search Platform launcher scoped to news',
    'search-platform',
    'premium-dark',
    'published',
    $json${"title":"ابحث في الأخبار","description":"انتقل إلى صفحة البحث الموحدة لاستكشاف أخبار فينيسيا.","placeholder":"اكتب كلمة البحث...","helpText":"البحث داخل الأخبار المنشورة.","scope":"selected","contentTypes":["news"],"resultLimit":12,"presentation":"compact","filters":[],"defaultSort":"newest"}$json$::jsonb,
    72
  ),
  (
    'Search — Media Press',
    'media-press-search',
    'Compact Search Platform launcher scoped to press releases',
    'search-platform',
    'premium-dark',
    'published',
    $json${"title":"ابحث في البيانات الصحفية","description":"انتقل إلى صفحة البحث الموحدة لاستكشاف البيانات الصحفية.","placeholder":"اكتب كلمة البحث...","helpText":"البحث داخل البيانات الصحفية المنشورة.","scope":"selected","contentTypes":["press"],"resultLimit":12,"presentation":"compact","filters":[],"defaultSort":"newest"}$json$::jsonb,
    73
  ),
  (
    'Search — Media Site Updates',
    'media-site-updates-search',
    'Compact Search Platform launcher scoped to site updates',
    'search-platform',
    'premium-dark',
    'published',
    $json${"title":"ابحث في تحديثات المواقع","description":"انتقل إلى صفحة البحث الموحدة لاستكشاف تحديثات التنفيذ.","placeholder":"اكتب كلمة البحث...","helpText":"البحث داخل تحديثات المواقع المنشورة.","scope":"selected","contentTypes":["site_update"],"resultLimit":12,"presentation":"compact","filters":[],"defaultSort":"newest"}$json$::jsonb,
    74
  ),
  (
    'Search — Media Videos',
    'media-videos-search',
    'Compact Search Platform launcher scoped to videos',
    'search-platform',
    'premium-dark',
    'published',
    $json${"title":"ابحث في الفيديوهات","description":"انتقل إلى صفحة البحث الموحدة لاستكشاف الفيديوهات.","placeholder":"اكتب كلمة البحث...","helpText":"البحث داخل الفيديوهات المنشورة.","scope":"selected","contentTypes":["video"],"resultLimit":12,"presentation":"compact","filters":[],"defaultSort":"newest"}$json$::jsonb,
    75
  ),
  (
    'Search — Media Gallery',
    'media-gallery-search',
    'Compact Search Platform launcher scoped to galleries',
    'search-platform',
    'premium-dark',
    'published',
    $json${"title":"ابحث في معرض الصور","description":"انتقل إلى صفحة البحث الموحدة لاستكشاف معارض الصور.","placeholder":"اكتب كلمة البحث...","helpText":"البحث داخل معارض الصور المنشورة.","scope":"selected","contentTypes":["gallery"],"resultLimit":12,"presentation":"compact","filters":[],"defaultSort":"newest"}$json$::jsonb,
    76
  )
on conflict (slug) do nothing;

do $assign_search_page_composition$
declare
  v_page_id bigint;
  v_hero_id bigint;
  v_breadcrumb_id bigint;
  v_search_id bigint;
begin
  select id into strict v_page_id from public.pages where slug = 'search' and path = '/search';
  select id into strict v_hero_id from public.hero_templates where slug = 'hero-search';
  select id into strict v_breadcrumb_id from public.breadcrumb_block_templates where slug = 'breadcrumb-search';
  select id into strict v_search_id from public.content_block_templates where slug = 'search-platform';

  if not exists (
    select 1 from public.hero_assignments
    where target_type = 'page' and target_id = v_page_id and hero_id = v_hero_id
  ) then
    perform public.mutate_page_composition(
      v_page_id,
      'save_hero_assignment',
      jsonb_build_object('hero_id', v_hero_id, 'sort_order', 0, 'is_visible', true),
      null,
      'system:migration:20260830232134_search_platform_module'
    );
  end if;

  if not exists (
    select 1 from public.page_breadcrumb_block_assignments
    where page_id = v_page_id and template_id = v_breadcrumb_id
  ) then
    perform public.mutate_page_composition(
      v_page_id,
      'save_assignment',
      jsonb_build_object(
        'kind', 'breadcrumb',
        'template_id', v_breadcrumb_id,
        'slot', 'hero',
        'sort_order', 10,
        'is_visible', true
      ),
      null,
      'system:migration:20260830232134_search_platform_module'
    );
  end if;

  if not exists (
    select 1 from public.page_content_block_assignments
    where page_id = v_page_id and template_id = v_search_id
  ) then
    perform public.mutate_page_composition(
      v_page_id,
      'save_assignment',
      jsonb_build_object(
        'kind', 'content',
        'template_id', v_search_id,
        'slot', 'main',
        'sort_order', 10,
        'is_visible', true
      ),
      null,
      'system:migration:20260830232134_search_platform_module'
    );
  end if;
end;
$assign_search_page_composition$;

do $assign_scoped_search_launchers$
declare
  v_row record;
  v_page_id bigint;
  v_template_id bigint;
begin
  for v_row in
    select * from (values
      ('topics', 'topics-search'),
      ('media-center-news', 'media-news-search'),
      ('media-center-press', 'media-press-search'),
      ('media-center-site-updates', 'media-site-updates-search'),
      ('media-center-videos', 'media-videos-search'),
      ('media-center-gallery', 'media-gallery-search')
    ) as assignments(page_slug, template_slug)
  loop
    select id into strict v_page_id from public.pages where slug = v_row.page_slug;
    select id into strict v_template_id from public.content_block_templates where slug = v_row.template_slug;

    if not exists (
      select 1 from public.page_content_block_assignments
      where page_id = v_page_id and template_id = v_template_id
    ) then
      perform public.mutate_page_composition(
        v_page_id,
        'save_assignment',
        jsonb_build_object(
          'kind', 'content',
          'template_id', v_template_id,
          'slot', 'sidebar',
          'sort_order', 0,
          'is_visible', true
        ),
        null,
        'system:migration:20260830232134_search_platform_module'
      );
    end if;
  end loop;
end;
$assign_scoped_search_launchers$;

insert into public.admin_audit_logs (
  actor_admin_user_id,
  actor_username,
  action,
  entity_type,
  entity_id,
  entity_label,
  metadata
)
select
  null,
  'system:migration',
  'search_platform.adopted',
  'page',
  page.id,
  page.title,
  jsonb_build_object(
    'migration', '20260830232134_search_platform_module',
    'read_owner', 'public_content_read',
    'template_owner', 'content_block_templates',
    'placement_owner', 'mutate_page_composition',
    'public_path', page.path,
    'navigation_created', false,
    'footer_created', false,
    'parallel_runtime', false,
    'parallel_search_engine', false
  )
from public.pages page
where page.slug = 'search'
  and not exists (
    select 1 from public.admin_audit_logs log
    where log.action = 'search_platform.adopted'
      and log.entity_type = 'page'
      and log.entity_id = page.id
  );

do $assert_search_platform_closure$
begin
  if (
    select count(*)
    from public.content_block_templates
    where slug in (
      'search-platform',
      'topics-search',
      'media-news-search',
      'media-press-search',
      'media-site-updates-search',
      'media-videos-search',
      'media-gallery-search'
    )
      and variant = 'search-platform'
  ) <> 7 then
    raise exception 'Search Platform closure refused: expected seven CMS Search templates';
  end if;
  if not exists (
    select 1
    from public.pages page
    join public.hero_assignments hero on hero.target_type = 'page' and hero.target_id = page.id and hero.is_active
    join public.page_breadcrumb_block_assignments breadcrumb on breadcrumb.page_id = page.id and breadcrumb.is_visible
    join public.page_content_block_assignments content on content.page_id = page.id and content.is_visible
    join public.content_block_templates template on template.id = content.template_id and template.slug = 'search-platform'
    where page.slug = 'search' and page.path = '/search' and page.status = 'published'
  ) then
    raise exception 'Search Platform closure refused: /search composition is incomplete';
  end if;
end;
$assert_search_platform_closure$;

commit;
