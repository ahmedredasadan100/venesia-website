-- Site-wide structured settings (footer first consumer).
-- Idempotent: creates table and seeds footer.* keys when missing.

begin;

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.site_settings is 'Namespaced JSON settings (footer.brand, footer.contact_items, etc.)';

insert into public.site_settings (key, value)
values
  (
    'footer.brand',
    '{"title":"Venesia Developments","tagline":"Building trust before concrete."}'::jsonb
  ),
  (
    'footer.contact_items',
    '[
      {"icon":"⌖","label":"العنوان","value":"Street 12, New Cairo 1, Cairo Governorate","href":"https://maps.google.com/?q=Street+12,New+Cairo+1,Cairo+Governorate"},
      {"icon":"✆","label":"الرقم المختصر","value":"15875","href":"tel:15875"},
      {"icon":"✆","label":"موبايل","value":"01033766876","href":"tel:01033766876"},
      {"icon":"✉","label":"البريد الإلكتروني","value":"info@venesia-developments.com","href":"mailto:info@venesia-developments.com"}
    ]'::jsonb
  ),
  (
    'footer.social_links',
    '[
      {"platform":"facebook","label":"Facebook","href":"https://facebook.com/venesia-developments"},
      {"platform":"instagram","label":"Instagram","href":"https://instagram.com/venesia_developments"},
      {"platform":"tiktok","label":"TikTok","href":"https://tiktok.com/@venesiadevelopments"},
      {"platform":"youtube","label":"YouTube","href":"https://youtube.com/@venesia"},
      {"platform":"whatsapp","label":"WhatsApp","href":"https://wa.me/201033766876"},
      {"platform":"location","label":"Location","href":"https://maps.google.com/?q=Street+12,New+Cairo+1,Cairo+Governorate"}
    ]'::jsonb
  ),
  (
    'footer.legal',
    '{"copyright":"Venesia Developments. All rights reserved.","tagline":"Trust Built On Ground"}'::jsonb
  )
on conflict (key) do nothing;

commit;
