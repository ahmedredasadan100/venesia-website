-- Contact page CMS blocks seed
-- Migrates hardcoded Contact body sections into Content / CTA / Cards templates + assignments.
-- Hero remains on Hero Manager — not included here.
-- Idempotent: safe to re-run (upserts templates by slug, upserts assignments by page+template).

begin;

-- ---------------------------------------------------------------------------
-- Content templates
-- ---------------------------------------------------------------------------
insert into public.content_block_templates (name, slug, description, variant, style_preset, status, config, sort_order)
values
  (
    'Contact — Form Office',
    'contact-form-office',
    'معلومات مكتب التواصل',
    'default',
    'premium-dark',
    'published',
    $json${
      "title": "معلومات التواصل",
      "subtitle": "نستقبلك في مكتبنا لمناقشة تفاصيل المشروع، أنظمة السداد، وخطوات المعاينة الميدانية.",
      "body": "Core Business Mall، التجمع الخامس، القاهرة الجديدة\nمن السبت إلى الخميس - 9:00 ص إلى 8:00 م\n01033766876\n01033766876\ninfo@venesia-developments.com",
      "alignment": "start"
    }$json$::jsonb,
    20
  ),
  (
    'Contact — Form Header',
    'contact-form',
    'عنوان ووصف نموذج التواصل',
    'default',
    'premium-dark',
    'published',
    $json${
      "eyebrow": "إرسال الطلب",
      "title": "أرسل لنا رسالة",
      "subtitle": "اكتب بياناتك وسيتواصل معك أحد مستشاري فينيسيا لتوضيح التفاصيل المناسبة لك.",
      "alignment": "center"
    }$json$::jsonb,
    25
  ),
  (
    'Contact — Map',
    'contact-map',
    'قسم الخريطة',
    'default',
    'premium-dark',
    'published',
    $json${
      "eyebrow": "فتح في خرائط جوجل|https://maps.google.com",
      "title": "موقعنا على الخريطة",
      "subtitle": "موقعنا في قلب القاهرة الجديدة، قريب من أهم المحاور والمناطق الحيوية.",
      "body": "قريب من شارع التسعين\nقريب من الجامعة الأمريكية\nقريب من محاور القاهرة الجديدة\nسهولة الوصول من أكثر من اتجاه",
      "alignment": "start"
    }$json$::jsonb,
    30
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
    'Contact — Trust Cards',
    'contact-trust-cards',
    'بطاقات التواصل العائمة',
    'glass',
    'premium-dark',
    'published',
    $json${
      "columns": 4,
      "items": [
        { "icon": "phone", "title": "اتصل بنا", "body": "01033766876\nمن السبت إلى الخميس", "href": "tel:01033766876" },
        { "icon": "whatsapp", "title": "واتساب", "body": "01033766876\nرد سريع على استفساراتك", "href": "https://wa.me/201033766876" },
        { "icon": "mail", "title": "البريد الإلكتروني", "body": "info@venesia-developments.com\nنرد عليك في أقرب وقت", "href": "mailto:info@venesia-developments.com" },
        { "icon": "location", "title": "موقعنا", "body": "Core Business Mall\nالقاهرة الجديدة", "href": "https://maps.google.com" }
      ]
    }$json$::jsonb,
    10
  ),
  (
    'Contact — Reasons',
    'contact-reasons',
    'لماذا تتواصل مع فينيسيا',
    'glass',
    'premium-dark',
    'published',
    $json${
      "title": "لماذا تتواصل مع فينيسيا؟",
      "columns": 3,
      "items": [
        { "title": "اختيار أوضح", "body": "نساعدك تفهم الفرق بين السكن والاستثمار، وتختار بناءً على هدفك الحقيقي." },
        { "title": "معاينة على الأرض", "body": "نرتب لك زيارة ميدانية لمتابعة التنفيذ كما هو، بعيدًا عن الوعود الورقية." },
        { "title": "تفاصيل قبل القرار", "body": "نشرح لك الموقع، المساحات، أنظمة السداد، ومراحل التنفيذ قبل أي خطوة." }
      ]
    }$json$::jsonb,
    40
  ),
  (
    'Contact — Departments',
    'contact-departments',
    'أقسام خدمة العملاء',
    'glass',
    'premium-dark',
    'published',
    $json${
      "title": "الأقسام المتاحة لخدمتك",
      "columns": 3,
      "items": [
        { "title": "فريق المبيعات", "body": "مستشارون عقاريون لمساعدتك في اختيار الوحدة المناسبة.", "href": "/images/111.png" },
        { "title": "خدمة العملاء", "body": "متابعة مستمرة والرد على الاستفسارات بعد التعاقد.", "href": "/images/111.png" },
        { "title": "الإدارة الهندسية", "body": "متابعة جودة التنفيذ وتوثيق المراحل على أرض الواقع.", "href": "/images/111.png" }
      ]
    }$json$::jsonb,
    50
  ),
  (
    'Contact — FAQ',
    'contact-faq',
    'الأسئلة الشائعة',
    'glass',
    'premium-dark',
    'published',
    $json${
      "title": "الأسئلة الشائعة",
      "columns": 2,
      "items": [
        { "title": "ما هي المشاريع المتاحة حاليًا؟", "body": "يمكنك التواصل معنا لمعرفة أحدث الوحدات المتاحة حسب المشروع، المساحة، الدور، ونظام السداد المناسب لك." },
        { "title": "هل يمكن حجز معاينة للمشروع؟", "body": "نعم، يمكن ترتيب معاينة ميدانية لمتابعة الموقع ومراحل التنفيذ على أرض الواقع." },
        { "title": "ما هي طرق السداد المتاحة؟", "body": "تختلف أنظمة السداد حسب المشروع والوحدة، ويتم شرح الخطة المناسبة لك بوضوح قبل التعاقد." },
        { "title": "هل الأراضي مملوكة وخالصة الثمن؟", "body": "فلسفة فينيسيا قائمة على الأمان قبل البيع، لذلك نوضح للعميل موقف الأرض والمستندات قبل اتخاذ القرار." },
        { "title": "كيف أتواصل مع فريق المبيعات؟", "body": "يمكنك الاتصال مباشرة أو التواصل عبر واتساب، وسيقوم أحد المستشارين بالرد على استفسارك." },
        { "title": "ما هي مواعيد العمل؟", "body": "نعمل من السبت إلى الخميس، من الساعة 9 صباحًا حتى 8 مساءً." }
      ]
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
-- CTA template
-- ---------------------------------------------------------------------------
insert into public.cta_block_templates (name, slug, description, variant, style_preset, status, config, sort_order)
values
  (
    'Contact — Bottom CTA',
    'contact-cta',
    'دعوة التواصل السفلية',
    'band',
    'premium-dark',
    'published',
    $json${
      "title": "هل أنت مستعد لبدء رحلتك العقارية؟",
      "description": "تواصل معنا الآن وخذ أول خطوة نحو قرار عقاري أوضح مع فينيسيا للتطوير العقاري.",
      "primaryCta": { "label": "اتصل الآن", "href": "tel:01033766876" },
      "secondaryCta": { "label": "واتساب", "href": "https://wa.me/201033766876" },
      "backgroundImage": "/images/111.png",
      "backgroundStyle": "dark"
    }$json$::jsonb,
    70
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
-- Page assignments (Contact page only)
-- Requires pages.slug = 'contact'
-- ---------------------------------------------------------------------------
insert into public.page_cards_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'main', 10, true
from public.pages p
join public.cards_block_templates t on t.slug = 'contact-trust-cards'
where p.slug = 'contact'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = true,
  updated_at = now();

insert into public.page_content_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'main', 20, true
from public.pages p
join public.content_block_templates t on t.slug = 'contact-form-office'
where p.slug = 'contact'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = true,
  updated_at = now();

insert into public.page_content_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'main', 25, true
from public.pages p
join public.content_block_templates t on t.slug = 'contact-form'
where p.slug = 'contact'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = true,
  updated_at = now();

insert into public.page_content_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'main', 30, true
from public.pages p
join public.content_block_templates t on t.slug = 'contact-map'
where p.slug = 'contact'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = true,
  updated_at = now();

insert into public.page_cards_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'main', 40, true
from public.pages p
join public.cards_block_templates t on t.slug = 'contact-reasons'
where p.slug = 'contact'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = true,
  updated_at = now();

insert into public.page_cards_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'main', 50, true
from public.pages p
join public.cards_block_templates t on t.slug = 'contact-departments'
where p.slug = 'contact'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = true,
  updated_at = now();

insert into public.page_cards_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'main', 60, true
from public.pages p
join public.cards_block_templates t on t.slug = 'contact-faq'
where p.slug = 'contact'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = true,
  updated_at = now();

insert into public.page_cta_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'before-footer', 70, true
from public.pages p
join public.cta_block_templates t on t.slug = 'contact-cta'
where p.slug = 'contact'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = true,
  updated_at = now();

commit;
