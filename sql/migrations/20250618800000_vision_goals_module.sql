-- Vision & Goals reusable content module (structured text + image + two columns).
-- Seeds default template and assigns it to /about, replacing legacy about-vision assignment.
-- Idempotent.

begin;

insert into public.content_block_templates (name, slug, description, variant, style_preset, status, config, sort_order)
values
  (
    'Vision & Goals',
    'vision-goals',
    'رؤيتنا وأهدافنا — موديول قابل لإعادة الاستخدام',
    'vision-goals',
    'premium-dark',
    'published',
    $json${
      "eyebrow": "رؤيتنا وأهدافنا",
      "title": "حيث تلتقي جودة الحياة بقيمة الاستثمار",
      "intro": [
        "نؤمن أن التطوير العقاري ليس مجرد بناء مبانٍ، بل صناعة مجتمعات ومساحات تظل محتفظة بقيمتها لسنوات طويلة، وتمنح عملاءنا الثقة التي يبحثون عنها في كل خطوة.",
        "نسعى إلى تقديم تجربة عقارية متكاملة تضع احتياجات العميل في مقدمة الأولويات، وتحوّل الاستثمار العقاري إلى قيمة حقيقية يمكن رؤيتها على أرض الواقع."
      ],
      "image": "/images/about/who-we-are.png",
      "imageAlt": "رؤيتنا وأهدافنا",
      "vision": {
        "title": "رؤيتنا",
        "items": [
          { "title": "الثقة", "text": "نؤمن أن الثقة تُبنى بالتنفيذ والالتزام، لا بالوعود." },
          { "title": "الجودة", "text": "نهتم بأدق التفاصيل في التصميم والتنفيذ لنضمن قيمة تدوم." },
          { "title": "الشفافية", "text": "نحرص على وضوح المعلومات والالتزامات في جميع مراحل العمل." }
        ]
      },
      "goals": {
        "title": "أهدافنا",
        "items": [
          { "title": "الاستدامة", "text": "نطوّر مشروعات تضيف قيمة حقيقية للمكان وللأجيال القادمة." },
          { "title": "المسؤولية", "text": "نتعامل مع كل مشروع باعتباره التزامًا طويل الأمد تجاه عملائنا والمجتمع." },
          { "title": "تقديم تجربة عقارية أكثر وضوحًا", "text": "" }
        ]
      }
    }$json$::jsonb,
    25
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

delete from public.page_content_block_assignments a
using public.pages p, public.content_block_templates t
where a.page_id = p.id
  and a.template_id = t.id
  and p.slug = 'about'
  and t.slug = 'about-vision';

insert into public.page_content_block_assignments (page_id, template_id, slot, sort_order, is_visible)
select p.id, t.id, 'main', 30, true
from public.pages p
join public.content_block_templates t on t.slug = 'vision-goals'
where p.slug = 'about'
on conflict (page_id, template_id) do update set
  slot = excluded.slot,
  sort_order = excluded.sort_order,
  is_visible = true,
  updated_at = now();

commit;
