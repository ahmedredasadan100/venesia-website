-- Merge About Intro into one structured content module (text + images + beats).
-- Removes duplicate cards assignment on About page when intro carries embedded beats.
-- Idempotent.

begin;

update public.content_block_templates
set
  variant = 'about-intro',
  config = config || $json${
    "images": {
      "main": "/images/about/who-we-are-main.png",
      "secondary": "/images/about/who-we-are-secondary.png",
      "accent": "/images/about/who-we-are-accent.png",
      "mainAlt": "مشهد تنفيذ على أرض المشروع",
      "secondaryAlt": "توثيق واقعي لمراحل التنفيذ",
      "accentAlt": "تفصيلة من أرض التنفيذ"
    },
    "beats": [
      { "num": "01", "title": "البداية من الأرض", "text": "كل مشروع يبدأ من أصل واضح — أرض مملوكة، وقرار تنفيذي مسؤول." },
      { "num": "02", "title": "الإدارة على الأرض", "text": "متابعة هندسية حقيقية… ليست صورًا، بل نظامًا يعمل أمام العميل." },
      { "num": "03", "title": "المراحل موثّقة", "text": "كل خطوة تُسجّل وتُعرض — من الحفر إلى التسليم، بلا فجوات في السرد." }
    ]
  }$json$::jsonb,
  updated_at = now()
where slug = 'about-intro'
  and not (config ? 'beats');

-- Drop legacy separate beats assignment on About (intro module is now self-contained).
delete from public.page_cards_block_assignments a
using public.pages p, public.cards_block_templates t
where a.page_id = p.id
  and a.template_id = t.id
  and p.slug = 'about'
  and t.slug = 'about-documentary-beats';

commit;
