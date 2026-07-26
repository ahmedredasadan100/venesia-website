\set ON_ERROR_STOP on

update public.site_settings
set value = jsonb_build_object(
  'state', 'synced',
  'provider', 'supabase',
  'environment', 'ci',
  'environmentKey', 'postgres15:venesia_media_coordination_ci',
  'providerRegistryVersion', 'ci-registry-v1',
  'lastSuccessfulReconciliationRunIdentity', null,
  'lastSuccessfulReconciliationAt', null
)
where key = 'media.catalog_state';

insert into public.media_assets (
  id,
  provider,
  bucket,
  object_key,
  public_url,
  original_filename,
  display_name,
  media_kind,
  mime_type,
  extension,
  byte_size,
  folder_path,
  status,
  reconciliation_state,
  missing_object
)
select
  source.id,
  'supabase',
  'images',
  source.object_key,
  '/images/' || source.object_key,
  source.object_key,
  source.object_key,
  'image',
  'image/jpeg',
  '.jpg',
  100,
  'images',
  'active',
  'synced',
  false
from (
  values
    ('00000000-0000-0000-0000-0000000000c1'::uuid, 'coordination/concurrent-c1.jpg'),
    ('00000000-0000-0000-0000-0000000000c2'::uuid, 'coordination/concurrent-c2.jpg'),
    ('00000000-0000-0000-0000-0000000000c3'::uuid, 'coordination/concurrent-c3.jpg'),
    ('00000000-0000-0000-0000-0000000000c4'::uuid, 'coordination/concurrent-c4.jpg'),
    ('00000000-0000-0000-0000-0000000000c5'::uuid, 'coordination/concurrent-c5.jpg'),
    ('00000000-0000-0000-0000-0000000000c6'::uuid, 'coordination/concurrent-c6.jpg'),
    ('00000000-0000-0000-0000-0000000000c7'::uuid, 'coordination/concurrent-c7.jpg'),
    ('00000000-0000-0000-0000-0000000000c8'::uuid, 'coordination/concurrent-c8.jpg'),
    ('00000000-0000-0000-0000-0000000000c9'::uuid, 'coordination/concurrent-c9.jpg')
) source(id, object_key);
