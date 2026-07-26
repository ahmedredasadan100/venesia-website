-- Harden Media coordination RPC execution against Supabase's explicit default
-- function grants. This migration changes ACLs only.

begin;

revoke execute on function public.assert_media_catalog_coordination_ready(text, text, text, text) from public, anon, authenticated;
grant execute on function public.assert_media_catalog_coordination_ready(text, text, text, text) to service_role;

revoke execute on function public.acquire_media_reference_write_lease(jsonb, bigint, text, integer, text, text, text, text) from public, anon, authenticated;
grant execute on function public.acquire_media_reference_write_lease(jsonb, bigint, text, integer, text, text, text, text) to service_role;

revoke execute on function public.complete_media_reference_write_lease(uuid, text) from public, anon, authenticated;
grant execute on function public.complete_media_reference_write_lease(uuid, text) to service_role;

revoke execute on function public.fail_media_reference_write_lease(uuid, text, text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.fail_media_reference_write_lease(uuid, text, text, jsonb, boolean) to service_role;

revoke execute on function public.resolve_media_reference_write_lease(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.resolve_media_reference_write_lease(uuid, uuid, text, text) to service_role;

revoke execute on function public.transition_media_asset_identity_for_move(uuid, uuid, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.transition_media_asset_identity_for_move(uuid, uuid, text, text, text, text, text, text, text, text) to service_role;

revoke execute on function public.rollback_media_asset_identity_move(uuid, uuid, text, text, text, text, text, text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.rollback_media_asset_identity_move(uuid, uuid, text, text, text, text, text, text, text, text, text, boolean) to service_role;

revoke execute on function public.finalize_media_asset_identity_move(uuid, uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.finalize_media_asset_identity_move(uuid, uuid, text, text, text, text) to service_role;

revoke execute on function public.reserve_media_asset_deletion(uuid, bigint, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.reserve_media_asset_deletion(uuid, bigint, text, text, text, text, text, text, text, text) to service_role;

revoke execute on function public.cancel_media_asset_deletion(uuid, uuid, text, jsonb, text, timestamptz) from public, anon, authenticated;
grant execute on function public.cancel_media_asset_deletion(uuid, uuid, text, jsonb, text, timestamptz) to service_role;

revoke execute on function public.finalize_media_asset_deletion(uuid, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.finalize_media_asset_deletion(uuid, uuid, text, timestamptz) to service_role;

revoke execute on function public.mark_media_asset_delete_recovery(uuid, uuid, text, jsonb, text, timestamptz) from public, anon, authenticated;
grant execute on function public.mark_media_asset_delete_recovery(uuid, uuid, text, jsonb, text, timestamptz) to service_role;

revoke execute on function public.repair_media_delete_reservation(uuid, uuid, text, text, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.repair_media_delete_reservation(uuid, uuid, text, text, timestamptz, jsonb) to service_role;

revoke execute on function public.get_media_reference_provider_revision(text) from public, anon, authenticated;
grant execute on function public.get_media_reference_provider_revision(text) to service_role;

revoke execute on function public.replace_media_references_for_entity(text, text, text, jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.replace_media_references_for_entity(text, text, text, jsonb, uuid, text) to service_role;

revoke execute on function public.replace_media_references_for_provider(text, jsonb, uuid, bigint) from public, anon, authenticated;
grant execute on function public.replace_media_references_for_provider(text, jsonb, uuid, bigint) to service_role;

commit;
