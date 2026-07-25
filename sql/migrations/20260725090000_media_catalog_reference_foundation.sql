-- Persisted Media Catalog and reference-safety foundation.
-- Additive only: legacy /images and /files values remain unchanged and readable.

begin;

create table if not exists public.media_folders (
  id uuid primary key default gen_random_uuid(),
  normalized_path text not null,
  parent_path text,
  display_name text not null,
  created_by bigint references public.admin_users(id) on delete set null,
  reconciliation_state text not null default 'synced'
    check (reconciliation_state in ('synced', 'storage_only', 'catalog_only', 'uncertain')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_folders_normalized_path_unique unique (normalized_path),
  constraint media_folders_path_check check (
    normalized_path ~ '^(images|files)(/[A-Za-z0-9._-]+)*$'
  ),
  constraint media_folders_parent_not_self check (
    parent_path is null or parent_path <> normalized_path
  ),
  constraint media_folders_parent_fkey foreign key (parent_path)
    references public.media_folders(normalized_path)
    on update cascade on delete restrict
    deferrable initially deferred
);

create index if not exists media_folders_parent_path_idx
  on public.media_folders(parent_path, normalized_path);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('supabase')),
  bucket text not null,
  object_key text not null,
  public_url text not null,
  original_filename text not null,
  display_name text not null,
  media_kind text not null check (media_kind in ('image', 'document')),
  mime_type text,
  extension text not null,
  byte_size bigint check (byte_size is null or byte_size >= 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  checksum text,
  folder_path text not null,
  status text not null default 'active'
    check (status in ('active', 'deleting', 'deleted', 'missing')),
  uploaded_by bigint references public.admin_users(id) on delete set null,
  default_alt_text text,
  default_title text,
  default_caption text,
  reconciliation_state text not null default 'synced'
    check (reconciliation_state in ('synced', 'storage_only', 'catalog_only', 'missing_object', 'uncertain')),
  missing_object boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_assets_canonical_identity_unique unique (provider, bucket, object_key),
  constraint media_assets_public_url_unique unique (public_url),
  constraint media_assets_object_key_check check (
    object_key <> ''
    and object_key !~ '(^/|\\\\|(^|/)\\.\\.?(/|$))'
  ),
  constraint media_assets_folder_fkey foreign key (folder_path)
    references public.media_folders(normalized_path)
    on update cascade on delete restrict
    deferrable initially deferred
);

create index if not exists media_assets_folder_created_idx
  on public.media_assets(folder_path, created_at desc, id desc)
  where status <> 'deleted';

create index if not exists media_assets_kind_created_idx
  on public.media_assets(media_kind, created_at desc, id desc)
  where status <> 'deleted';

create index if not exists media_assets_reconciliation_idx
  on public.media_assets(reconciliation_state, missing_object)
  where status <> 'deleted';

create index if not exists media_assets_default_alt_idx
  on public.media_assets(default_alt_text)
  where media_kind = 'image' and status <> 'deleted';

create table if not exists public.media_references (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.media_assets(id) on delete cascade,
  domain_key text not null,
  entity_type text not null,
  entity_identity text not null,
  entity_label text,
  field_key text not null,
  edit_href text,
  public_href text,
  reference_state text not null default 'active'
    check (reference_state in ('draft', 'active', 'archived', 'soft_deleted', 'restorable')),
  restorable boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_references_identity_unique unique (
    asset_id, domain_key, entity_type, entity_identity, field_key
  )
);

create index if not exists media_references_asset_state_idx
  on public.media_references(asset_id, reference_state, entity_type);

create index if not exists media_references_entity_idx
  on public.media_references(domain_key, entity_type, entity_identity);

create or replace view public.admin_media_assets_catalog
with (security_invoker = true)
as
select
  a.*,
  count(r.id)::bigint as reference_count
from public.media_assets a
left join public.media_references r on r.asset_id = a.id
group by a.id;

create or replace view public.admin_media_folders_catalog
with (security_invoker = true)
as
select
  f.*,
  (
    select count(*)::bigint
    from public.media_folders child
    where child.parent_path = f.normalized_path
  ) as child_folder_count,
  (
    select count(*)::bigint
    from public.media_assets a
    where a.folder_path = f.normalized_path
      and a.status <> 'deleted'
  ) as direct_asset_count,
  (
    select coalesce(sum(a.byte_size), 0)::bigint
    from public.media_assets a
    where a.folder_path = f.normalized_path
      and a.status <> 'deleted'
  ) as direct_total_bytes
from public.media_folders f;

create or replace function public.set_media_catalog_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.replace_media_references_for_entity(
  p_domain_key text,
  p_entity_type text,
  p_entity_identity text,
  p_references jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  if coalesce(trim(p_domain_key), '') = ''
    or coalesce(trim(p_entity_type), '') = ''
    or coalesce(trim(p_entity_identity), '') = ''
    or jsonb_typeof(coalesce(p_references, '[]'::jsonb)) <> 'array'
  then
    raise exception 'invalid media reference synchronization input';
  end if;

  delete from public.media_references
  where domain_key = p_domain_key
    and entity_type = p_entity_type
    and entity_identity = p_entity_identity;

  insert into public.media_references (
    asset_id,
    domain_key,
    entity_type,
    entity_identity,
    entity_label,
    field_key,
    edit_href,
    public_href,
    reference_state,
    restorable,
    metadata
  )
  select
    (entry->>'assetId')::uuid,
    p_domain_key,
    p_entity_type,
    p_entity_identity,
    nullif(entry->>'entityLabel', ''),
    entry->>'fieldKey',
    nullif(entry->>'editHref', ''),
    nullif(entry->>'publicHref', ''),
    coalesce(nullif(entry->>'referenceState', ''), 'active'),
    coalesce((entry->>'restorable')::boolean, false),
    coalesce(entry->'metadata', '{}'::jsonb)
  from jsonb_array_elements(coalesce(p_references, '[]'::jsonb)) entry
  where coalesce(entry->>'assetId', '') <> ''
    and coalesce(entry->>'fieldKey', '') <> ''
  on conflict (asset_id, domain_key, entity_type, entity_identity, field_key)
  do update set
    entity_label = excluded.entity_label,
    edit_href = excluded.edit_href,
    public_href = excluded.public_href,
    reference_state = excluded.reference_state,
    restorable = excluded.restorable,
    metadata = excluded.metadata,
    updated_at = now();

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.replace_media_references_for_provider(
  p_domain_key text,
  p_references jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  if coalesce(trim(p_domain_key), '') = ''
    or jsonb_typeof(coalesce(p_references, '[]'::jsonb)) <> 'array'
  then
    raise exception 'invalid media provider reconciliation input';
  end if;

  delete from public.media_references where domain_key = p_domain_key;

  insert into public.media_references (
    asset_id,
    domain_key,
    entity_type,
    entity_identity,
    entity_label,
    field_key,
    edit_href,
    public_href,
    reference_state,
    restorable,
    metadata
  )
  select
    (entry->>'assetId')::uuid,
    p_domain_key,
    entry->>'entityType',
    entry->>'entityIdentity',
    nullif(entry->>'entityLabel', ''),
    entry->>'fieldKey',
    nullif(entry->>'editHref', ''),
    nullif(entry->>'publicHref', ''),
    coalesce(nullif(entry->>'referenceState', ''), 'active'),
    coalesce((entry->>'restorable')::boolean, false),
    coalesce(entry->'metadata', '{}'::jsonb)
  from jsonb_array_elements(coalesce(p_references, '[]'::jsonb)) entry
  where coalesce(entry->>'assetId', '') <> ''
    and coalesce(entry->>'entityType', '') <> ''
    and coalesce(entry->>'entityIdentity', '') <> ''
    and coalesce(entry->>'fieldKey', '') <> ''
  on conflict (asset_id, domain_key, entity_type, entity_identity, field_key)
  do update set
    entity_label = excluded.entity_label,
    edit_href = excluded.edit_href,
    public_href = excluded.public_href,
    reference_state = excluded.reference_state,
    restorable = excluded.restorable,
    metadata = excluded.metadata,
    updated_at = now();

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

drop trigger if exists media_folders_set_updated_at on public.media_folders;
create trigger media_folders_set_updated_at
before update on public.media_folders
for each row execute function public.set_media_catalog_updated_at();

drop trigger if exists media_assets_set_updated_at on public.media_assets;
create trigger media_assets_set_updated_at
before update on public.media_assets
for each row execute function public.set_media_catalog_updated_at();

drop trigger if exists media_references_set_updated_at on public.media_references;
create trigger media_references_set_updated_at
before update on public.media_references
for each row execute function public.set_media_catalog_updated_at();

alter table public.media_folders enable row level security;
alter table public.media_assets enable row level security;
alter table public.media_references enable row level security;

revoke all on public.media_folders, public.media_assets, public.media_references from anon, authenticated;
grant select, insert, update, delete on public.media_folders, public.media_assets, public.media_references to service_role;

grant select on public.admin_media_assets_catalog to service_role;
grant select on public.admin_media_folders_catalog to service_role;
revoke all on function public.replace_media_references_for_entity(text, text, text, jsonb) from public;
grant execute on function public.replace_media_references_for_entity(text, text, text, jsonb) to service_role;
revoke all on function public.replace_media_references_for_provider(text, jsonb) from public;
grant execute on function public.replace_media_references_for_provider(text, jsonb) to service_role;

insert into public.media_folders (normalized_path, parent_path, display_name, reconciliation_state)
values
  ('images', null, 'الصور', 'synced'),
  ('files', null, 'المستندات', 'synced')
on conflict (normalized_path) do nothing;

insert into public.site_settings (key, value)
values (
  'media.settings',
  jsonb_build_object(
    'maxImageBytes', 5242880,
    'maxDocumentBytes', 12582912,
    'allowedKinds', jsonb_build_array('image', 'document'),
    'allowedImageExtensions', jsonb_build_array('.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'),
    'allowedDocumentExtensions', jsonb_build_array('.pdf'),
    'mimeVerification', true,
    'collisionPolicy', 'unique_name',
    'safeDeletePolicy', 'authoritative_zero_references'
  )
)
on conflict (key) do nothing;

insert into public.site_settings (key, value)
values (
  'media.catalog_state',
  jsonb_build_object(
    'state', 'uncertain',
    'providerRegistryVersion', null,
    'lastCatalogSync', null,
    'lastDryRun', null,
    'warnings', jsonb_build_array('Initial reconciliation is required before destructive operations.')
  )
)
on conflict (key) do nothing;

comment on table public.media_assets is
  'Canonical managed media identity: provider + bucket + normalized object_key.';
comment on table public.media_folders is
  'Persistent folder hierarchy, including empty folders not represented by Supabase Storage.';
comment on table public.media_references is
  'Persisted domain-owned media references used by fail-closed deletion and replacement.';

commit;
