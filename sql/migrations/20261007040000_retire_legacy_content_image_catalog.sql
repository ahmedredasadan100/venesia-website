-- Retire only the removed public/images compatibility inventory.
-- Authored content values and all Supabase objects/identities remain untouched.
-- Deleted tombstones preserve coordination and audit history; this is not a
-- Managed Storage deletion and must never invoke its physical-delete adapter.
begin;

lock table public.media_assets, public.media_references,
  public.media_reference_write_leases in share row exclusive mode;

do $$
begin
  if exists (
    select 1 from public.media_reference_write_leases lease
    join public.media_assets asset on asset.id = lease.asset_id
    where asset.provider = 'filesystem' and asset.bucket = 'public'
      and asset.object_key like 'images/%'
      and lease.status = 'active' and lease.expires_at > clock_timestamp()
  ) then
    raise exception 'legacy_content_image_retirement_has_active_write_lease';
  end if;
end;
$$;

-- This table is a derived usage index, not the authored content fields.
delete from public.media_references reference
using public.media_assets asset
where reference.asset_id = asset.id
  and asset.provider = 'filesystem' and asset.bucket = 'public'
  and asset.object_key like 'images/%';

with retired as (
  update public.media_assets
  set status = 'deleted', reconciliation_state = 'synced', missing_object = false,
      metadata = metadata || jsonb_build_object(
        'retirement', 'legacy-content-images',
        'retirement_migration', '20261007040000',
        'authored_references_preserved', true
      ), updated_at = now()
  where provider = 'filesystem' and bucket = 'public'
    and object_key like 'images/%' and status <> 'deleted'
  returning id, object_key
)
insert into public.admin_audit_logs (actor_username, action, entity_type, entity_label, metadata)
select 'migration:20261007040000', 'media_asset.delete', 'media_catalog',
       'legacy-content-images-retirement',
       jsonb_build_object('retired_count', count(*), 'retired_assets', jsonb_agg(to_jsonb(retired)),
         'scope', 'filesystem:public:images/', 'authored_references_preserved', true,
         'managed_storage_untouched', true)
from retired having count(*) > 0;

-- Do not allow a later compatibility scan to recreate this retired inventory.
alter table public.media_assets
  add constraint media_assets_retired_content_images_check check (
    not (provider = 'filesystem' and bucket = 'public' and object_key like 'images/%')
    or status = 'deleted'
  );

commit;
