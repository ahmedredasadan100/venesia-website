-- About page CMS blocks seed
-- Migrates hardcoded About body sections into Content / CTA / Cards templates + assignments.
-- Hero remains on Hero Manager — not included here.
-- Idempotent: safe to re-run (upserts templates by slug, upserts assignments by page+template).

begin;

-- ---------------------------------------------------------------------------
-- Content templates
-- ---------------------------------------------------------------------------
insert into public.content_block_templates (name, slug, description, variant, style_preset, status, config, sort_order)
values
  (
    'About — Intro',
    'about-intro',
    'مقدمة صفحة من نحن',
    'default',
    'premium-dark',
    'published',
    $json${
      "eyebrow": "Who We Are",
      "title": "لسنا شركة عقارية تقليدية.",
      "subtitle": "نؤمن أن العقار ليس مجرد مبنى يُشيَّد، بل مسؤولية تبدأ من أول قرار وتنتهي عند تسليم مشروع يحقق ما وُعِد به.",
      "body": "في فينيسيا، الثقة ليست وعدًا... الثقة فعل.\n\nلذلك لا نقيس نجاحنا بعدد الكلمات التي نقولها، بل بعدد الإنجازات التي يمكن رؤيتها على أرض الواقع.\n\nنؤمن أن الطمأنينة الحقيقية لا تأتي من العروض التسويقية، بل من مشروع يتقدم يومًا بعد يوم أمام أعين عملائه.\n\nلهذا نحرص على توثيق مراحل التنفيذ، ومشاركة تفاصيل العمل، والالتزام بمعايير الجودة في كل خطوة من خطوات البناء.\n\nفي فينيسيا، المشروع ليس عرضًا للبيع، بل سجلّ حيّ يروي رحلة التنفيذ من أول يوم وحتى التسليم.\n\nلأن ما نبنيه لا يقتصر على المباني فقط، بل يمتد إلى بناء الثقة التي تستمر لسنوات.",
      "alignment": "start"
    }$json$::jsonb,
    10
  ),
  (
    'About — Vision',
    'about-vision',
    'رؤيتنا وأهدافنا',
    'default',
    'premium-dark',
    'published',
    $json${
      "eyebrow": "رؤيتنا وأهدافنا",
      "title": "حيث تلتقي جودة الحياة بقيمة الاستثمار",
      "body": "نؤمن أن التطوير العقاري ليس مجرد بناء مبانٍ، بل صناعة مجتمعات ومساحات تظل محتفظة بقيمتها لسنوات طويلة، وتمنح عملاءنا الثقة التي يبحثون عنها في كل خطوة.\n\nنسعى إلى تقديم تجربة عقارية متكاملة تضع احتياجات العميل في مقدمة الأولويات، وتحوّل الاستثمار العقاري إلى قيمة حقيقية يمكن رؤيتها على أرض الواقع.",
      "alignment": "start"
    }$json$::jsonb,
    30
  ),
  (
    'About — Approach',
    'about-approach',
    'Our approach',
    'default',
    'premium-dark',
    'published',
    $json${
      "eyebrow": "Our approach",
      "title": "نصوغ تجربة عقارية هادئة — حيث كل تفصيلة تخدم الثقة، لا الضجيج.",
      "alignment": "center"
    }$json$::jsonb,
    40
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  variant = excluded.variant,
  style_preset = excluded.style_preset,
  status = excluded.status,
  config = excluded.config,
  sort_order = excluded.sort_order,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Cards templates
-- ---------------------------------------------------------------------------
insert into public.cards_block_templates (name, slug, description, variant, style_preset, status, config, sort_order)
values
  (
    'About — Documentary Beats',
    'about-documentary-beats',
    'ثلاث مراحل توثيق التنفيذ',
    'glass',
    'premium-dark',
    'published',
    $json${
      "columns": 3,
      "items": [
        { "icon": "01", "title": "البداية من الأرض", "body": "كل مشروع يبدأ من أصل واضح — أرض مملوكة، وقرار تنفيذي مسؤول." },
        { "icon": "02", "title": "الإدارة على الأرض", "body": "متابعة هندسية حقيقية… ليست صورًا، بل نظامًا يعمل أمام العميل." },
        { "icon": "03", "title": "المراحل موثّقة", "body": "كل خطوة تُسجّل وتُعرض — من الحفر إلى التسليم، بلا فجوات في السرد." }
      ]
    }$json$::jsonb,
    20
  ),
  (
    'About — Principles',
    'about-principles',
    'مبادئ فينيسيا',
    'glass',
    'premium-dark',
    'published',
    $json${
      "eyebrow": "What defines us",
      "title": "مبادئ تُحكى بهدوء",
      "columns": 3,
      "items": [
        { "title": "أراضٍ مملوكة", "body": "بداية أي ثقة حقيقية تبدأ من أصل واضح ومدفوع." },
        { "title": "إدارة هندسية", "body": "متابعة تنفيذ — نظام يعمل على الأرض، لا في العروض." },
        { "title": "مراحل موثّقة", "body": "كل مرحلة لها معنى… وكل خطوة تثبت أن الوعد يتحول لحقيقة." }
      ]
    }$json$::jsonb,
    50
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  variant = excluded.variant,
  style_preset = excluded.style_preset,
  status = excluded.status,
  config = excluded.config,
  sort_order = excluded.sort_order,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- CTA template
-- ---------------------------------------------------------------------------
insert into public.cta_block_templates (name, slug, description, variant, style_preset, status, config, sort_order)
values
  (
    'About — Projects CTA',
    'about-projects-cta',
    'دعوة استكشاف المشاريع',
    'band',
    'premium-dark',
    'published',
    $json${
      "eyebrow": "Venesia Developments",
      "title": "استكشف مشاريعنا",
      "description": "انتقل إلى صفحة المشاريع لمتابعة التنفيذ والتفاصيل.",
      "primaryCta": { "label": "استكشف المشاريع ↗", "href": "/projects" },
      "backgroundImage": "/images/about/who-we-are.png",
      "backgroundStyle": "dark"
    }$json$::jsonb,
    60
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  variant = excluded.variant,
  style_preset = excluded.style_preset,
  status = excluded.status,
  config = excluded.config,
  sort_order = excluded.sort_order,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Page assignments (About page only)
-- Requires pages.slug = 'about'
-- ---------------------------------------------------------------------------
insert into public.page_content_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'main', 10, true
from public.pages p
join public.content_block_templates t on t.slug = 'about-intro'
where p.slug = 'about'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = true,
  updated_at = now();

insert into public.page_cards_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'main', 20, true
from public.pages p
join public.cards_block_templates t on t.slug = 'about-documentary-beats'
where p.slug = 'about'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = true,
  updated_at = now();

insert into public.page_content_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'main', 30, true
from public.pages p
join public.content_block_templates t on t.slug = 'about-vision'
where p.slug = 'about'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = true,
  updated_at = now();

insert into public.page_content_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'main', 40, true
from public.pages p
join public.content_block_templates t on t.slug = 'about-approach'
where p.slug = 'about'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = true,
  updated_at = now();

insert into public.page_cards_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'main', 50, true
from public.pages p
join public.cards_block_templates t on t.slug = 'about-principles'
where p.slug = 'about'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = true,
  updated_at = now();

insert into public.page_cta_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'before-footer', 60, true
from public.pages p
join public.cta_block_templates t on t.slug = 'about-projects-cta'
where p.slug = 'about'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = true,
  updated_at = now();

commit;
