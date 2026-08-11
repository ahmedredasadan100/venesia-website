\set ON_ERROR_STOP on

create schema media_coordination_test;

create or replace function media_coordination_test.assert_true(
  p_condition boolean,
  p_message text
)
returns void
language plpgsql
as $$
begin
  if p_condition is distinct from true then
    raise exception 'media_coordination_assertion_failed: %', p_message;
  end if;
end;
$$;

create or replace function media_coordination_test.expect_error(
  p_sql text,
  p_expected_message text
)
returns void
language plpgsql
as $$
declare
  observed_message text;
begin
  begin
    execute p_sql;
  exception when others then
    observed_message := sqlerrm;
    if position(p_expected_message in observed_message) > 0 then
      return;
    end if;
    raise exception
      'media_coordination_wrong_error: expected %, observed %',
      p_expected_message,
      observed_message;
  end;

  raise exception 'media_coordination_expected_error_not_raised: %', p_expected_message;
end;
$$;

create table media_coordination_test.runtime_state (
  key text primary key,
  value text not null
);

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
    ('00000000-0000-0000-0000-0000000000a1'::uuid, 'coordination/a1.jpg'),
    ('00000000-0000-0000-0000-0000000000a2'::uuid, 'coordination/a2.jpg'),
    ('00000000-0000-0000-0000-0000000000a3'::uuid, 'coordination/a3.jpg'),
    ('00000000-0000-0000-0000-0000000000a4'::uuid, 'coordination/a4.jpg'),
    ('00000000-0000-0000-0000-0000000000a5'::uuid, 'coordination/a5.jpg'),
    ('00000000-0000-0000-0000-0000000000a6'::uuid, 'coordination/a6.jpg'),
    ('00000000-0000-0000-0000-0000000000a7'::uuid, 'coordination/a7.jpg'),
    ('00000000-0000-0000-0000-0000000000a8'::uuid, 'coordination/a8.jpg'),
    ('00000000-0000-0000-0000-0000000000a9'::uuid, 'coordination/a9.jpg'),
    ('00000000-0000-0000-0000-0000000000aa'::uuid, 'coordination/a10.jpg'),
    ('00000000-0000-0000-0000-0000000000ab'::uuid, 'coordination/a11.jpg'),
    ('00000000-0000-0000-0000-0000000000ac'::uuid, 'coordination/a12.jpg')
) source(id, object_key);

-- Delete reservation is bound to the exact canonical identity proved by the
-- caller; a stale path for the same asset UUID must not reserve or delete it.
select media_coordination_test.expect_error(
  $sql$
    select * from public.reserve_media_asset_deletion(
      '00000000-0000-0000-0000-0000000000a3', null, 'ci-stale-delete-identity',
      'supabase', 'images', 'coordination/stale-a3.jpg',
      'supabase', 'ci', 'postgres15:venesia_media_coordination_ci', 'ci-registry-v1'
    )
  $sql$,
  'media_delete_asset_identity_changed'
);

-- A reverse-ordered input must acquire one atomic batch token for both assets.
insert into media_coordination_test.runtime_state (key, value)
select 'batch_lease', lease_token::text
from public.acquire_media_reference_write_lease(
  '[
    {"provider":"supabase","bucket":"images","objectKey":"coordination/a2.jpg","domainKey":"pages","entityType":"page","entityIdentity":"provisional:page"},
    {"provider":"supabase","bucket":"images","objectKey":"coordination/a1.jpg","domainKey":"content","entityType":"topic","entityIdentity":"provisional:topic"}
  ]'::jsonb,
  null,
  'ci-batch-lease',
  180,
  'supabase',
  'ci',
  'postgres15:venesia_media_coordination_ci',
  'ci-registry-v1'
)
where leased_asset_count = 2;

select media_coordination_test.assert_true(
  (
    select count(*) = 2
      and count(distinct lease_token) = 1
      and array_agg(asset_id order by asset_id) = array[
        '00000000-0000-0000-0000-0000000000a1'::uuid,
        '00000000-0000-0000-0000-0000000000a2'::uuid
      ]
    from public.media_reference_write_leases
    where lease_token = (
      select value::uuid
      from media_coordination_test.runtime_state
      where key = 'batch_lease'
    )
  ),
  'reverse-ordered multi-asset input did not create one complete, stable batch'
);

-- Complete token mismatch is rejected before any lease row changes state.
select media_coordination_test.expect_error(
  $sql$
    select public.complete_media_reference_write_lease(
      '40000000-0000-0000-0000-000000000004', 'provisional:topic'
    )
  $sql$,
  'media_write_lease_not_active'
);

select media_coordination_test.expect_error(
  format(
    $sql$
      select public.complete_media_reference_write_lease(%L::uuid, 'wrong-completion-identity')
    $sql$,
    (select value from media_coordination_test.runtime_state where key = 'batch_lease')
  ),
  'media_write_lease_identity_mismatch'
);

-- An active write lease must prevent reservation (lease -> reservation).
select media_coordination_test.expect_error(
  $sql$
    select * from public.reserve_media_asset_deletion(
      '00000000-0000-0000-0000-0000000000a1', null, 'ci-lease-first',
      'supabase', 'images', 'coordination/a1.jpg',
      'supabase', 'ci', 'postgres15:venesia_media_coordination_ci', 'ci-registry-v1'
    )
  $sql$,
  'media_delete_write_lease_unresolved'
);

-- Entity synchronization rejects unleased assets, NULL payloads, and mismatches.
select media_coordination_test.expect_error(
  $sql$
    select public.replace_media_references_for_entity(
      'content', 'topic', 'topic-unleased',
      '[{"assetId":"00000000-0000-0000-0000-0000000000a3","fieldKey":"image"}]'::jsonb,
      null, null
    )
  $sql$,
  'media_reference_write_lease_required'
);

select media_coordination_test.expect_error(
  $sql$
    select public.replace_media_references_for_entity(
      'content', 'topic', 'topic-null', null, null, null
    )
  $sql$,
  'invalid_media_reference_synchronization_input'
);

select media_coordination_test.expect_error(
  format(
    $sql$
      select public.replace_media_references_for_entity(
        'content', 'topic', 'topic-a',
        '[{"assetId":"00000000-0000-0000-0000-0000000000a1","fieldKey":"image"}]'::jsonb,
        %L::uuid, 'wrong-provisional-identity'
      )
    $sql$,
    (select value from media_coordination_test.runtime_state where key = 'batch_lease')
  ),
  'media_reference_write_lease_mismatch'
);

select public.replace_media_references_for_entity(
  'content',
  'topic',
  'topic-a',
  '[{"assetId":"00000000-0000-0000-0000-0000000000a1","fieldKey":"image"}]'::jsonb,
  (select value::uuid from media_coordination_test.runtime_state where key = 'batch_lease'),
  'provisional:topic'
);

-- Completion is batch-wide and must fail until every declared target is synced.
select media_coordination_test.expect_error(
  format(
    $sql$
      select public.complete_media_reference_write_lease(%L::uuid, 'provisional:topic')
    $sql$,
    (select value from media_coordination_test.runtime_state where key = 'batch_lease')
  ),
  'media_write_lease_sync_incomplete'
);

select public.replace_media_references_for_entity(
  'pages',
  'page',
  'page-b',
  '[{"assetId":"00000000-0000-0000-0000-0000000000a2","fieldKey":"hero_image"}]'::jsonb,
  (select value::uuid from media_coordination_test.runtime_state where key = 'batch_lease'),
  'provisional:page'
);

select media_coordination_test.assert_true(
  public.complete_media_reference_write_lease(
    (select value::uuid from media_coordination_test.runtime_state where key = 'batch_lease'),
    'provisional:topic'
  ) = 2,
  'fully synchronized two-asset lease did not complete as a batch'
);

-- [] is an explicit clear and must remove the prior entity references.
select public.replace_media_references_for_entity(
  'content', 'topic', 'topic-a', '[]'::jsonb, null, null
);
select media_coordination_test.assert_true(
  not exists (
    select 1 from public.media_references
    where domain_key = 'content'
      and entity_type = 'topic'
      and entity_identity = 'topic-a'
  ),
  'explicit empty references did not clear the prior entity reference'
);

-- Completion is atomic across the batch: one effectively expired row must
-- prevent every otherwise-ready row from transitioning to completed.
insert into media_coordination_test.runtime_state (key, value)
select 'partially_expired_batch', lease_token::text
from public.acquire_media_reference_write_lease(
  '[
    {"provider":"supabase","bucket":"images","objectKey":"coordination/a8.jpg","domainKey":"content","entityType":"topic","entityIdentity":"provisional:expiry-a"},
    {"provider":"supabase","bucket":"images","objectKey":"coordination/a9.jpg","domainKey":"pages","entityType":"page","entityIdentity":"provisional:expiry-b"}
  ]'::jsonb,
  null,
  'ci-partially-expired-batch',
  180,
  'supabase',
  'ci',
  'postgres15:venesia_media_coordination_ci',
  'ci-registry-v1'
);
select public.replace_media_references_for_entity(
  'content', 'topic', 'expiry-a',
  '[{"assetId":"00000000-0000-0000-0000-0000000000a8","fieldKey":"image"}]'::jsonb,
  (select value::uuid from media_coordination_test.runtime_state where key = 'partially_expired_batch'),
  'provisional:expiry-a'
);
select public.replace_media_references_for_entity(
  'pages', 'page', 'expiry-b',
  '[{"assetId":"00000000-0000-0000-0000-0000000000a9","fieldKey":"hero_image"}]'::jsonb,
  (select value::uuid from media_coordination_test.runtime_state where key = 'partially_expired_batch'),
  'provisional:expiry-b'
);
update public.media_reference_write_leases
set
  started_at = clock_timestamp() - interval '2 minutes',
  expires_at = clock_timestamp() - interval '1 minute'
where lease_token = (
    select value::uuid from media_coordination_test.runtime_state
    where key = 'partially_expired_batch'
  )
  and asset_id = '00000000-0000-0000-0000-0000000000a9';
select media_coordination_test.expect_error(
  format(
    $sql$
      select public.complete_media_reference_write_lease(
        %L::uuid, 'provisional:expiry-a'
      )
    $sql$,
    (select value from media_coordination_test.runtime_state where key = 'partially_expired_batch')
  ),
  'media_write_lease_not_active'
);
select media_coordination_test.assert_true(
  (
    select count(*) = 2
      and count(*) filter (where status = 'active') = 2
      and count(*) filter (where status = 'completed') = 0
    from public.media_reference_write_leases
    where lease_token = (
      select value::uuid from media_coordination_test.runtime_state
      where key = 'partially_expired_batch'
    )
  ),
  'partially expired batch completion was not atomic'
);
select public.fail_media_reference_write_lease(
  (select value::uuid from media_coordination_test.runtime_state where key = 'partially_expired_batch'),
  'provisional:expiry-a',
  'ci-partially-expired-cleanup',
  '{}'::jsonb,
  false
);

-- A reservation must prevent a later lease (reservation -> lease).
insert into media_coordination_test.runtime_state (key, value)
select 'reservation_first', reservation_id::text
from public.reserve_media_asset_deletion(
  '00000000-0000-0000-0000-0000000000a3',
  null,
  'ci-reservation-first',
  'supabase',
  'images',
  'coordination/a3.jpg',
  'supabase',
  'ci',
  'postgres15:venesia_media_coordination_ci',
  'ci-registry-v1'
);

select media_coordination_test.expect_error(
  $sql$
    select * from public.acquire_media_reference_write_lease(
      '[{"provider":"supabase","bucket":"images","objectKey":"coordination/a3.jpg","domainKey":"content","entityType":"topic","entityIdentity":"reserved-target"}]'::jsonb,
      null, 'ci-reservation-blocks-lease', 180,
      'supabase', 'ci', 'postgres15:venesia_media_coordination_ci', 'ci-registry-v1'
    )
  $sql$,
  'media_write_lease_asset_not_active'
);
select media_coordination_test.assert_true(
  not exists (
    select 1 from public.media_reference_write_leases
    where asset_id = '00000000-0000-0000-0000-0000000000a3'
  ),
  'reservation-first failure left a partial lease row'
);

-- Cancel token mismatch cannot compensate an unrelated reservation.
select media_coordination_test.expect_error(
  $sql$
    select public.cancel_media_asset_deletion(
      '00000000-0000-0000-0000-0000000000a3',
      '40000000-0000-0000-0000-000000000001',
      'ci-wrong-reservation', '{}'::jsonb, 'exists', clock_timestamp()
    )
  $sql$,
  'media_delete_reservation_not_active'
);

-- Reconciliation/provider synchronization must not relink a deleting asset.
select media_coordination_test.expect_error(
  $sql$
    select public.replace_media_references_for_provider(
      'ci.deleting-provider',
      '[{"assetId":"00000000-0000-0000-0000-0000000000a3","entityType":"topic","entityIdentity":"deleting-topic","fieldKey":"image"}]'::jsonb,
      '40000000-0000-0000-0000-000000000002',
      public.get_media_reference_provider_revision('ci.deleting-provider')
    )
  $sql$,
  'media_reference_asset_not_active'
);
select media_coordination_test.assert_true(
  not exists (
    select 1 from public.media_references
    where asset_id = '00000000-0000-0000-0000-0000000000a3'
      and domain_key = 'ci.deleting-provider'
  ),
  'reconciliation relinked a deleting asset'
);

-- Cancellation requires recent Storage-exists evidence.
select media_coordination_test.expect_error(
  format(
    $sql$
      select public.cancel_media_asset_deletion(
        '00000000-0000-0000-0000-0000000000a3', %L::uuid,
        'ci-cancel', '{}'::jsonb, 'uncertain', clock_timestamp()
      )
    $sql$,
    (select value from media_coordination_test.runtime_state where key = 'reservation_first')
  ),
  'media_delete_storage_existence_not_proven'
);

select media_coordination_test.assert_true(
  public.cancel_media_asset_deletion(
    '00000000-0000-0000-0000-0000000000a3',
    (select value::uuid from media_coordination_test.runtime_state where key = 'reservation_first'),
    'ci-cancel',
    '{}'::jsonb,
    'exists',
    clock_timestamp()
  ) = 'active',
  'Storage-exists proof did not cancel the reservation'
);

-- Finalization requires recent Storage-missing evidence.
insert into media_coordination_test.runtime_state (key, value)
select 'finalize_reservation', reservation_id::text
from public.reserve_media_asset_deletion(
  '00000000-0000-0000-0000-0000000000a3',
  null,
  'ci-finalize',
  'supabase',
  'images',
  'coordination/a3.jpg',
  'supabase',
  'ci',
  'postgres15:venesia_media_coordination_ci',
  'ci-registry-v1'
);

select media_coordination_test.expect_error(
  format(
    $sql$
      select public.finalize_media_asset_deletion(
        '00000000-0000-0000-0000-0000000000a3', %L::uuid,
        'exists', clock_timestamp()
      )
    $sql$,
    (select value from media_coordination_test.runtime_state where key = 'finalize_reservation')
  ),
  'media_delete_storage_absence_not_proven'
);

-- Finalize token mismatch cannot complete an unrelated reservation.
select media_coordination_test.expect_error(
  $sql$
    select public.finalize_media_asset_deletion(
      '00000000-0000-0000-0000-0000000000a3',
      '40000000-0000-0000-0000-000000000003',
      'missing', clock_timestamp()
    )
  $sql$,
  'media_delete_reservation_not_active'
);

select media_coordination_test.assert_true(
  public.finalize_media_asset_deletion(
    '00000000-0000-0000-0000-0000000000a3',
    (select value::uuid from media_coordination_test.runtime_state where key = 'finalize_reservation'),
    'missing',
    clock_timestamp()
  ) = 'deleted',
  'Storage-missing proof did not finalize deletion'
);

-- A failed, non-committed lease is resolved immediately and no longer blocks delete.
insert into media_coordination_test.runtime_state (key, value)
select 'lease_then_delete', lease_token::text
from public.acquire_media_reference_write_lease(
  '[{"provider":"supabase","bucket":"images","objectKey":"coordination/a4.jpg","domainKey":"content","entityType":"topic","entityIdentity":"lease-first-target"}]'::jsonb,
  null, 'ci-lease-first', 180,
  'supabase', 'ci', 'postgres15:venesia_media_coordination_ci', 'ci-registry-v1'
);

select media_coordination_test.expect_error(
  $sql$
    select * from public.reserve_media_asset_deletion(
      '00000000-0000-0000-0000-0000000000a4', null, 'ci-delete-blocked',
      'supabase', 'images', 'coordination/a4.jpg',
      'supabase', 'ci', 'postgres15:venesia_media_coordination_ci', 'ci-registry-v1'
    )
  $sql$,
  'media_delete_write_lease_unresolved'
);

select public.fail_media_reference_write_lease(
  (select value::uuid from media_coordination_test.runtime_state where key = 'lease_then_delete'),
  'lease-first-target',
  'ci-domain-not-written',
  '{}'::jsonb,
  false
);

-- Uncertain recovery remains nonterminal; confirm_missing is terminal evidence.
insert into media_coordination_test.runtime_state (key, value)
select 'uncertain_reservation', reservation_id::text
from public.reserve_media_asset_deletion(
  '00000000-0000-0000-0000-0000000000a4',
  null,
  'ci-uncertain-recovery',
  'supabase',
  'images',
  'coordination/a4.jpg',
  'supabase',
  'ci',
  'postgres15:venesia_media_coordination_ci',
  'ci-registry-v1'
);

select media_coordination_test.assert_true(
  public.mark_media_asset_delete_recovery(
    '00000000-0000-0000-0000-0000000000a4',
    (select value::uuid from media_coordination_test.runtime_state where key = 'uncertain_reservation'),
    'ci-storage-uncertain',
    '{}'::jsonb,
    'uncertain',
    clock_timestamp()
  ) = 'deleting',
  'uncertain Storage result was incorrectly made terminal'
);

select media_coordination_test.assert_true(
  (
    select asset.status = 'deleting'
      and asset.reconciliation_state = 'uncertain'
      and not asset.missing_object
      and reservation.status = 'recovery_required'
    from public.media_assets asset
    join public.media_delete_reservations reservation
      on reservation.asset_id = asset.id
    where asset.id = '00000000-0000-0000-0000-0000000000a4'
      and reservation.id = (
        select value::uuid from media_coordination_test.runtime_state
        where key = 'uncertain_reservation'
      )
  ),
  'uncertain recovery state is not fail-closed and nonterminal'
);

select media_coordination_test.assert_true(
  public.repair_media_delete_reservation(
    '00000000-0000-0000-0000-0000000000a4',
    (select value::uuid from media_coordination_test.runtime_state where key = 'uncertain_reservation'),
    'confirm_missing',
    'missing',
    clock_timestamp(),
    '{}'::jsonb
  ) = 'missing',
  'confirm_missing did not return the terminal missing state'
);
select media_coordination_test.assert_true(
  (
    select status = 'missing_confirmed' and finished_at is not null
    from public.media_delete_reservations
    where id = (
      select value::uuid from media_coordination_test.runtime_state
      where key = 'uncertain_reservation'
    )
  ),
  'confirm_missing did not persist a terminal reservation state'
);

-- A claim that Storage is missing is evidence-bearing and cannot omit its
-- verification timestamp.
insert into media_coordination_test.runtime_state (key, value)
select 'missing_without_timestamp_reservation', reservation_id::text
from public.reserve_media_asset_deletion(
  '00000000-0000-0000-0000-0000000000aa',
  null,
  'ci-missing-without-timestamp',
  'supabase',
  'images',
  'coordination/a10.jpg',
  'supabase',
  'ci',
  'postgres15:venesia_media_coordination_ci',
  'ci-registry-v1'
);
select media_coordination_test.expect_error(
  format(
    $sql$
      select public.mark_media_asset_delete_recovery(
        '00000000-0000-0000-0000-0000000000aa', %L::uuid,
        'ci-missing-without-timestamp', '{}'::jsonb, 'missing', null
      )
    $sql$,
    (
      select value from media_coordination_test.runtime_state
      where key = 'missing_without_timestamp_reservation'
    )
  ),
  'invalid_media_delete_recovery_input'
);
select media_coordination_test.assert_true(
  public.cancel_media_asset_deletion(
    '00000000-0000-0000-0000-0000000000aa',
    (
      select value::uuid from media_coordination_test.runtime_state
      where key = 'missing_without_timestamp_reservation'
    ),
    'ci-missing-without-timestamp-cleanup',
    '{}'::jsonb,
    'exists',
    clock_timestamp()
  ) = 'active',
  'missing-without-timestamp rejection did not preserve a cancellable reservation'
);

-- Storage deletion followed by application-side finalization failure is
-- represented as recovery_required + missing, never as a silent completion.
insert into media_coordination_test.runtime_state (key, value)
select 'storage_deleted_finalization_failed', reservation_id::text
from public.reserve_media_asset_deletion(
  '00000000-0000-0000-0000-0000000000aa',
  null,
  'ci-storage-deleted-finalization-failed',
  'supabase',
  'images',
  'coordination/a10.jpg',
  'supabase',
  'ci',
  'postgres15:venesia_media_coordination_ci',
  'ci-registry-v1'
);
select media_coordination_test.assert_true(
  public.mark_media_asset_delete_recovery(
    '00000000-0000-0000-0000-0000000000aa',
    (
      select value::uuid from media_coordination_test.runtime_state
      where key = 'storage_deleted_finalization_failed'
    ),
    'ci-finalization-failed-after-storage-delete',
    '{}'::jsonb,
    'missing',
    clock_timestamp()
  ) = 'missing',
  'Storage-deleted finalization failure did not enter missing recovery state'
);
select media_coordination_test.assert_true(
  (
    select asset.status = 'missing'
      and asset.reconciliation_state = 'uncertain'
      and asset.missing_object
      and reservation.status = 'recovery_required'
    from public.media_assets asset
    join public.media_delete_reservations reservation
      on reservation.asset_id = asset.id
    where asset.id = '00000000-0000-0000-0000-0000000000aa'
      and reservation.id = (
        select value::uuid from media_coordination_test.runtime_state
        where key = 'storage_deleted_finalization_failed'
      )
  ),
  'Storage-deleted finalization failure was not recoverable and fail-closed'
);
select media_coordination_test.assert_true(
  public.repair_media_delete_reservation(
    '00000000-0000-0000-0000-0000000000aa',
    (
      select value::uuid from media_coordination_test.runtime_state
      where key = 'storage_deleted_finalization_failed'
    ),
    'finalize',
    'missing',
    clock_timestamp(),
    '{}'::jsonb
  ) = 'deleted',
  'recovery finalization did not complete with fresh Storage-missing proof'
);

-- Provider synchronization locks the union of old and requested assets.
insert into public.media_references (
  asset_id, domain_key, entity_type, entity_identity, field_key
)
values (
  '00000000-0000-0000-0000-0000000000a5',
  'provider.union',
  'legacy',
  'old-row',
  'image'
);

insert into media_coordination_test.runtime_state (key, value)
select 'provider_old_asset_lease', lease_token::text
from public.acquire_media_reference_write_lease(
  '[{"provider":"supabase","bucket":"images","objectKey":"coordination/a5.jpg","domainKey":"provider.union","entityType":"legacy","entityIdentity":"old-row"}]'::jsonb,
  null, 'ci-provider-old-union', 180,
  'supabase', 'ci', 'postgres15:venesia_media_coordination_ci', 'ci-registry-v1'
);

select media_coordination_test.expect_error(
  $sql$
    select public.replace_media_references_for_provider(
      'provider.union',
      '[{"assetId":"00000000-0000-0000-0000-0000000000a1","entityType":"topic","entityIdentity":"new-row","fieldKey":"image"}]'::jsonb,
      '10000000-0000-0000-0000-000000000001',
      public.get_media_reference_provider_revision('provider.union')
    )
  $sql$,
  'media_reconciliation_write_lease_active'
);

select public.fail_media_reference_write_lease(
  (select value::uuid from media_coordination_test.runtime_state where key = 'provider_old_asset_lease'),
  'old-row',
  'ci-no-write',
  '{}'::jsonb,
  false
);

select media_coordination_test.assert_true(
  public.replace_media_references_for_provider(
    'provider.union',
    '[{"assetId":"00000000-0000-0000-0000-0000000000a1","entityType":"topic","entityIdentity":"new-row","fieldKey":"image"}]'::jsonb,
    '10000000-0000-0000-0000-000000000002',
    public.get_media_reference_provider_revision('provider.union')
  ) = 1,
  'provider synchronization did not replace the union after the lease resolved'
);
select media_coordination_test.assert_true(
  not exists (
    select 1 from public.media_references
    where domain_key = 'provider.union'
      and asset_id = '00000000-0000-0000-0000-0000000000a5'
  )
  and exists (
    select 1 from public.media_references
    where domain_key = 'provider.union'
      and asset_id = '00000000-0000-0000-0000-0000000000a1'
  ),
  'provider synchronization did not clear old and insert requested references'
);

select media_coordination_test.expect_error(
  $sql$
    select public.replace_media_references_for_provider(
      'provider.union', null, '10000000-0000-0000-0000-000000000003', 0
    )
  $sql$,
  'invalid_media_provider_synchronization_input'
);

-- A provider snapshot is fenced by the domain revision captured before its
-- scan. A completed entity write must make the stale provider payload fail.
insert into public.media_references (
  asset_id, domain_key, entity_type, entity_identity, field_key
)
values (
  '00000000-0000-0000-0000-0000000000a1',
  'revision.completed',
  'topic',
  'revision-row',
  'image'
);
insert into media_coordination_test.runtime_state (key, value)
values (
  'revision_completed_snapshot',
  public.get_media_reference_provider_revision('revision.completed')::text
);
insert into media_coordination_test.runtime_state (key, value)
select 'revision_completed_lease', lease_token::text
from public.acquire_media_reference_write_lease(
  '[{"provider":"supabase","bucket":"images","objectKey":"coordination/a2.jpg","domainKey":"revision.completed","entityType":"topic","entityIdentity":"revision-row"}]'::jsonb,
  null, 'ci-revision-completed', 180,
  'supabase', 'ci', 'postgres15:venesia_media_coordination_ci', 'ci-registry-v1'
);
select public.replace_media_references_for_entity(
  'revision.completed', 'topic', 'revision-row',
  '[{"assetId":"00000000-0000-0000-0000-0000000000a2","fieldKey":"image"}]'::jsonb,
  (select value::uuid from media_coordination_test.runtime_state where key = 'revision_completed_lease'),
  'revision-row'
);
select public.complete_media_reference_write_lease(
  (select value::uuid from media_coordination_test.runtime_state where key = 'revision_completed_lease'),
  'revision-row'
);
select media_coordination_test.expect_error(
  format(
    $sql$
      select public.replace_media_references_for_provider(
        'revision.completed',
        '[{"assetId":"00000000-0000-0000-0000-0000000000a1","entityType":"topic","entityIdentity":"revision-row","fieldKey":"image"}]'::jsonb,
        '11000000-0000-0000-0000-000000000001',
        %L::bigint
      )
    $sql$,
    (select value from media_coordination_test.runtime_state where key = 'revision_completed_snapshot')
  ),
  'media_reconciliation_snapshot_stale'
);
select media_coordination_test.assert_true(
  exists (
    select 1 from public.media_references
    where domain_key = 'revision.completed'
      and asset_id = '00000000-0000-0000-0000-0000000000a2'
  )
  and not exists (
    select 1 from public.media_references
    where domain_key = 'revision.completed'
      and asset_id = '00000000-0000-0000-0000-0000000000a1'
  ),
  'stale provider snapshot overwrote a completed entity write'
);

-- Active leases are discovered by their declared domain target, even when the
-- newly attached asset is absent from both the stale payload and persisted refs.
insert into public.media_references (
  asset_id, domain_key, entity_type, entity_identity, field_key
)
values (
  '00000000-0000-0000-0000-0000000000a1',
  'revision.active',
  'topic',
  'active-row',
  'image'
);
insert into media_coordination_test.runtime_state (key, value)
select 'revision_active_lease', lease_token::text
from public.acquire_media_reference_write_lease(
  '[{"provider":"supabase","bucket":"images","objectKey":"coordination/a2.jpg","domainKey":"revision.active","entityType":"topic","entityIdentity":"active-row"}]'::jsonb,
  null, 'ci-revision-active-outside-union', 180,
  'supabase', 'ci', 'postgres15:venesia_media_coordination_ci', 'ci-registry-v1'
);
select media_coordination_test.expect_error(
  $sql$
    select public.replace_media_references_for_provider(
      'revision.active',
      '[{"assetId":"00000000-0000-0000-0000-0000000000a1","entityType":"topic","entityIdentity":"active-row","fieldKey":"image"}]'::jsonb,
      '11000000-0000-0000-0000-000000000002',
      0
    )
  $sql$,
  'media_reconciliation_write_lease_active'
);
select public.fail_media_reference_write_lease(
  (select value::uuid from media_coordination_test.runtime_state where key = 'revision_active_lease'),
  'active-row',
  'ci-revision-active-cleanup',
  '{}'::jsonb,
  false
);

-- Explicit-empty has no asset lease, so the same revision fence must prevent a
-- stale provider snapshot from resurrecting the removed reference.
insert into public.media_references (
  asset_id, domain_key, entity_type, entity_identity, field_key
)
values (
  '00000000-0000-0000-0000-0000000000a1',
  'revision.empty',
  'topic',
  'empty-row',
  'image'
);
insert into media_coordination_test.runtime_state (key, value)
values (
  'revision_empty_snapshot',
  public.get_media_reference_provider_revision('revision.empty')::text
);
select public.replace_media_references_for_entity(
  'revision.empty', 'topic', 'empty-row', '[]'::jsonb, null, null
);
select media_coordination_test.expect_error(
  format(
    $sql$
      select public.replace_media_references_for_provider(
        'revision.empty',
        '[{"assetId":"00000000-0000-0000-0000-0000000000a1","entityType":"topic","entityIdentity":"empty-row","fieldKey":"image"}]'::jsonb,
        '11000000-0000-0000-0000-000000000003',
        %L::bigint
      )
    $sql$,
    (select value from media_coordination_test.runtime_state where key = 'revision_empty_snapshot')
  ),
  'media_reconciliation_snapshot_stale'
);
select media_coordination_test.assert_true(
  not exists (
    select 1 from public.media_references
    where domain_key = 'revision.empty'
  ),
  'stale provider snapshot resurrected an explicit-empty entity reference'
);

-- A Domain write whose entity synchronization fails advances the provider
-- revision when the lease is marked failed. A scan captured before that
-- failure cannot later be accepted as authoritative.
insert into public.media_references (
  asset_id, domain_key, entity_type, entity_identity, field_key
)
values (
  '00000000-0000-0000-0000-0000000000a1',
  'revision.failed',
  'topic',
  'failed-row',
  'image'
);
insert into media_coordination_test.runtime_state (key, value)
values (
  'revision_failed_snapshot',
  public.get_media_reference_provider_revision('revision.failed')::text
);
insert into media_coordination_test.runtime_state (key, value)
select 'revision_failed_lease', lease_token::text
from public.acquire_media_reference_write_lease(
  '[{"provider":"supabase","bucket":"images","objectKey":"coordination/a2.jpg","domainKey":"revision.failed","entityType":"topic","entityIdentity":"failed-row"}]'::jsonb,
  null, 'ci-revision-failed', 180,
  'supabase', 'ci', 'postgres15:venesia_media_coordination_ci', 'ci-registry-v1'
);
select public.fail_media_reference_write_lease(
  (select value::uuid from media_coordination_test.runtime_state where key = 'revision_failed_lease'),
  'failed-row',
  'ci-domain-committed-sync-failed',
  '{}'::jsonb,
  true
);
select media_coordination_test.expect_error(
  format(
    $sql$
      select public.replace_media_references_for_provider(
        'revision.failed',
        '[{"assetId":"00000000-0000-0000-0000-0000000000a1","entityType":"topic","entityIdentity":"failed-row","fieldKey":"image"}]'::jsonb,
        '11000000-0000-0000-0000-000000000004',
        %L::bigint
      )
    $sql$,
    (select value from media_coordination_test.runtime_state where key = 'revision_failed_snapshot')
  ),
  'media_reconciliation_snapshot_stale'
);
select media_coordination_test.assert_true(
  public.get_media_reference_provider_revision('revision.failed')
    > (select value::bigint from media_coordination_test.runtime_state where key = 'revision_failed_snapshot'),
  'failed write lease did not advance the provider revision fence'
);

-- A committed failed lease can resolve only with a later successful run in the
-- exact provider/environment/registry context captured by that lease.
insert into media_coordination_test.runtime_state (key, value)
select 'failed_lease', lease_token::text
from public.acquire_media_reference_write_lease(
  '[{"provider":"supabase","bucket":"images","objectKey":"coordination/a6.jpg","domainKey":"content","entityType":"topic","entityIdentity":"failed-target"}]'::jsonb,
  null, 'ci-failed-lease', 180,
  'supabase', 'ci', 'postgres15:venesia_media_coordination_ci', 'ci-registry-v1'
);
select public.fail_media_reference_write_lease(
  (select value::uuid from media_coordination_test.runtime_state where key = 'failed_lease'),
  'failed-target',
  'ci-domain-write-committed',
  '{}'::jsonb,
  true
);

select media_coordination_test.expect_error(
  $sql$
    select * from public.reserve_media_asset_deletion(
      '00000000-0000-0000-0000-0000000000a6', null, 'ci-failed-lease-blocks-delete',
      'supabase', 'images', 'coordination/a6.jpg',
      'supabase', 'ci', 'postgres15:venesia_media_coordination_ci', 'ci-registry-v1'
    )
  $sql$,
  'media_delete_write_lease_unresolved'
);

select media_coordination_test.expect_error(
  format(
    $sql$
      select public.resolve_media_reference_write_lease(
        %L::uuid, '20000000-0000-0000-0000-000000000001', 'ci-reconcile', null
      )
    $sql$,
    (select value from media_coordination_test.runtime_state where key = 'failed_lease')
  ),
  'media_write_lease_reconciliation_not_proven'
);

select pg_sleep(0.01);
update public.site_settings
set value = jsonb_build_object(
  'state', 'synced',
  'provider', 'supabase',
  'environment', 'ci',
  'environmentKey', 'wrong-environment-key',
  'providerRegistryVersion', 'ci-registry-v1',
  'lastSuccessfulReconciliationRunIdentity', '20000000-0000-0000-0000-000000000001',
  'lastSuccessfulReconciliationAt', clock_timestamp()
)
where key = 'media.catalog_state';

select media_coordination_test.expect_error(
  format(
    $sql$
      select public.resolve_media_reference_write_lease(
        %L::uuid, '20000000-0000-0000-0000-000000000001', 'ci-reconcile', null
      )
    $sql$,
    (select value from media_coordination_test.runtime_state where key = 'failed_lease')
  ),
  'media_write_lease_reconciliation_context_mismatch'
);

update public.site_settings
set value = value || jsonb_build_object(
  'environmentKey', 'postgres15:venesia_media_coordination_ci'
)
where key = 'media.catalog_state';
select media_coordination_test.assert_true(
  public.resolve_media_reference_write_lease(
    (select value::uuid from media_coordination_test.runtime_state where key = 'failed_lease'),
    '20000000-0000-0000-0000-000000000001',
    'ci-reconcile',
    null
  ) = 1,
  'exact reconciliation context did not resolve the failed lease'
);

-- TTL is not a Domain-commit fence. Even an effectively expired active lease
-- blocks provider reconciliation and safe delete until its owning workflow
-- explicitly fails or completes it.
-- Keep the provider reference on a different asset so the delete assertion
-- below proves that the unresolved lease is the sole blocker for a7.
insert into public.media_references (
  asset_id, domain_key, entity_type, entity_identity, field_key
)
values (
  '00000000-0000-0000-0000-0000000000a6',
  'expired.provider',
  'topic',
  'expired-target',
  'image'
);

insert into media_coordination_test.runtime_state (key, value)
select 'expired_lease', lease_token::text
from public.acquire_media_reference_write_lease(
  '[{"provider":"supabase","bucket":"images","objectKey":"coordination/a7.jpg","domainKey":"expired.provider","entityType":"topic","entityIdentity":"expired-target"}]'::jsonb,
  null, 'ci-expired-lease', 180,
  'supabase', 'ci', 'postgres15:venesia_media_coordination_ci', 'ci-registry-v1'
);
update public.media_reference_write_leases
set
  started_at = clock_timestamp() - interval '2 minutes',
  expires_at = clock_timestamp() - interval '1 minute'
where lease_token = (
  select value::uuid from media_coordination_test.runtime_state where key = 'expired_lease'
);

select media_coordination_test.expect_error(
  $sql$
    select * from public.reserve_media_asset_deletion(
      '00000000-0000-0000-0000-0000000000a7', null, 'ci-expired-blocks-delete',
      'supabase', 'images', 'coordination/a7.jpg',
      'supabase', 'ci', 'postgres15:venesia_media_coordination_ci', 'ci-registry-v1'
    )
  $sql$,
  'media_delete_write_lease_unresolved'
);

select media_coordination_test.expect_error(
  $sql$
    select public.replace_media_references_for_provider(
      'expired.provider',
      '[]'::jsonb,
      '20000000-0000-0000-0000-000000000002',
      public.get_media_reference_provider_revision('expired.provider')
    )
  $sql$,
  'media_reconciliation_write_lease_active'
);
select media_coordination_test.assert_true(
  exists (
    select 1 from public.media_references
    where domain_key = 'expired.provider'
  ),
  'expired active lease allowed provider reconciliation to rewrite references'
);
select media_coordination_test.assert_true(
  exists (
    select 1 from public.media_reference_write_leases
    where lease_token = (
      select value::uuid from media_coordination_test.runtime_state where key = 'expired_lease'
    )
      and status = 'active'
      and resolved_at is null
  ),
  'provider reconciliation resolved or discarded the expired lease implicitly'
);
select media_coordination_test.expect_error(
  $sql$
    select * from public.reserve_media_asset_deletion(
      '00000000-0000-0000-0000-0000000000a7', null, 'ci-expired-still-blocks-delete',
      'supabase', 'images', 'coordination/a7.jpg',
      'supabase', 'ci', 'postgres15:venesia_media_coordination_ci', 'ci-registry-v1'
    )
  $sql$,
  'media_delete_write_lease_unresolved'
);

select media_coordination_test.assert_true(
  public.fail_media_reference_write_lease(
    (select value::uuid from media_coordination_test.runtime_state where key = 'expired_lease'),
    'expired-target',
    'ci-expired-owner-confirmed-no-domain-commit',
    '{}'::jsonb,
    false
  ) = 1,
  'owning workflow could not fail the expired active lease safely'
);
select media_coordination_test.assert_true(
  public.replace_media_references_for_provider(
    'expired.provider',
    '[]'::jsonb,
    '20000000-0000-0000-0000-000000000002',
    public.get_media_reference_provider_revision('expired.provider')
  ) = 0,
  'provider reconciliation did not resume after the active lease was explicitly closed'
);
select media_coordination_test.assert_true(
  not exists (
    select 1 from public.media_references
    where domain_key = 'expired.provider'
  ),
  'post-closure provider reconciliation did not apply its empty payload'
);

insert into media_coordination_test.runtime_state (key, value)
select 'expired_lease_delete_reservation', reservation_id::text
from public.reserve_media_asset_deletion(
  '00000000-0000-0000-0000-0000000000a7', null, 'ci-expired-resolved-delete',
  'supabase', 'images', 'coordination/a7.jpg',
  'supabase', 'ci', 'postgres15:venesia_media_coordination_ci', 'ci-registry-v1'
);
select media_coordination_test.assert_true(
  exists (
    select 1 from public.media_delete_reservations
    where id = (
      select value::uuid from media_coordination_test.runtime_state
      where key = 'expired_lease_delete_reservation'
    )
      and status = 'reserved'
  ),
  'delete reservation did not become available after expired lease owner closure'
);
select media_coordination_test.assert_true(
  public.cancel_media_asset_deletion(
    '00000000-0000-0000-0000-0000000000a7',
    (
      select value::uuid from media_coordination_test.runtime_state
      where key = 'expired_lease_delete_reservation'
    ),
    'ci-expired-resolved-cleanup',
    '{}'::jsonb,
    'exists',
    clock_timestamp()
  ) = 'active',
  'resolved expired-lease test reservation did not compensate to active'
);

-- Physical move keeps one lease through the Catalog transition and final
-- synchronization state. The transition itself acknowledges the synthetic
-- asset target, so completion cannot race a stale delete reservation.
insert into media_coordination_test.runtime_state (key, value)
select 'physical_move_lease', lease_token::text
from public.acquire_media_reference_write_lease(
  '[{"provider":"supabase","bucket":"images","objectKey":"coordination/a11.jpg","domainKey":"media_catalog_physical_move","entityType":"media_asset","entityIdentity":"00000000-0000-0000-0000-0000000000ab"}]'::jsonb,
  null, 'ci-physical-move', 180,
  'supabase', 'ci', 'postgres15:venesia_media_coordination_ci', 'ci-registry-v1'
);
select media_coordination_test.assert_true(
  public.transition_media_asset_identity_for_move(
    '00000000-0000-0000-0000-0000000000ab',
    (select value::uuid from media_coordination_test.runtime_state where key = 'physical_move_lease'),
    'supabase', 'images', 'coordination/a11.jpg', '/images/coordination/a11.jpg',
    'images', 'coordination/moved-a11.jpg', '/images/coordination/moved-a11.jpg', 'images/coordination'
  ) = 1,
  'physical move Catalog transition failed'
);
select media_coordination_test.assert_true(
  exists (
    select 1 from public.media_assets
    where id = '00000000-0000-0000-0000-0000000000ab'
      and object_key = 'coordination/moved-a11.jpg'
      and reconciliation_state = 'uncertain'
  ),
  'physical move transition did not retain an uncertain Catalog state'
);
select media_coordination_test.assert_true(
  public.finalize_media_asset_identity_move(
    '00000000-0000-0000-0000-0000000000ab',
    (select value::uuid from media_coordination_test.runtime_state where key = 'physical_move_lease'),
    'supabase', 'images', 'coordination/moved-a11.jpg', '/images/coordination/moved-a11.jpg'
  ) = 1,
  'physical move Catalog finalization failed'
);
select media_coordination_test.assert_true(
  public.complete_media_reference_write_lease(
    (select value::uuid from media_coordination_test.runtime_state where key = 'physical_move_lease'),
    '00000000-0000-0000-0000-0000000000ab'
  ) = 1,
  'physical move lease did not complete atomically'
);
select media_coordination_test.expect_error(
  $sql$
    select * from public.reserve_media_asset_deletion(
      '00000000-0000-0000-0000-0000000000ab', null, 'ci-stale-after-move',
      'supabase', 'images', 'coordination/a11.jpg',
      'supabase', 'ci', 'postgres15:venesia_media_coordination_ci', 'ci-registry-v1'
    )
  $sql$,
  'media_delete_asset_identity_changed'
);

-- A compensated move restores the exact old identity while the same lease is
-- still unresolved, then records a non-committed failure.
insert into media_coordination_test.runtime_state (key, value)
select 'physical_move_rollback_lease', lease_token::text
from public.acquire_media_reference_write_lease(
  '[{"provider":"supabase","bucket":"images","objectKey":"coordination/a12.jpg","domainKey":"media_catalog_physical_move","entityType":"media_asset","entityIdentity":"00000000-0000-0000-0000-0000000000ac"}]'::jsonb,
  null, 'ci-physical-move-rollback', 180,
  'supabase', 'ci', 'postgres15:venesia_media_coordination_ci', 'ci-registry-v1'
);
select public.transition_media_asset_identity_for_move(
  '00000000-0000-0000-0000-0000000000ac',
  (select value::uuid from media_coordination_test.runtime_state where key = 'physical_move_rollback_lease'),
  'supabase', 'images', 'coordination/a12.jpg', '/images/coordination/a12.jpg',
  'images', 'coordination/moved-a12.jpg', '/images/coordination/moved-a12.jpg', 'images/coordination'
);
select media_coordination_test.assert_true(
  public.rollback_media_asset_identity_move(
    '00000000-0000-0000-0000-0000000000ac',
    (select value::uuid from media_coordination_test.runtime_state where key = 'physical_move_rollback_lease'),
    'supabase', 'images', 'coordination/moved-a12.jpg', '/images/coordination/moved-a12.jpg',
    'images', 'coordination/a12.jpg', '/images/coordination/a12.jpg', 'images', 'synced', false
  ) = 1,
  'physical move Catalog rollback failed'
);
select media_coordination_test.assert_true(
  public.fail_media_reference_write_lease(
    (select value::uuid from media_coordination_test.runtime_state where key = 'physical_move_rollback_lease'),
    '00000000-0000-0000-0000-0000000000ac',
    'ci-physical-move-compensated', '{}'::jsonb, false
  ) = 1,
  'compensated physical move lease did not resolve safely'
);

-- RLS and grants: service_role may use RPCs/read evidence but may not mutate
-- coordination tables directly; anon/authenticated have no direct access.
select media_coordination_test.assert_true(
  (
    select bool_and(relrowsecurity)
    from pg_class
    where oid in (
      'public.media_delete_reservations'::regclass,
      'public.media_reference_write_leases'::regclass,
      'public.media_reference_provider_revisions'::regclass
    )
  ),
  'coordination tables are not both protected by RLS'
);
select media_coordination_test.assert_true(
  has_table_privilege('service_role', 'public.media_delete_reservations', 'SELECT')
  and not has_table_privilege('service_role', 'public.media_delete_reservations', 'INSERT')
  and not has_table_privilege('service_role', 'public.media_delete_reservations', 'UPDATE')
  and not has_table_privilege('service_role', 'public.media_delete_reservations', 'DELETE')
  and has_table_privilege('service_role', 'public.media_reference_write_leases', 'SELECT')
  and not has_table_privilege('service_role', 'public.media_reference_write_leases', 'INSERT')
  and not has_table_privilege('service_role', 'public.media_reference_write_leases', 'UPDATE')
  and not has_table_privilege('service_role', 'public.media_reference_write_leases', 'DELETE')
  and has_table_privilege('service_role', 'public.media_reference_provider_revisions', 'SELECT')
  and not has_table_privilege('service_role', 'public.media_reference_provider_revisions', 'INSERT')
  and not has_table_privilege('service_role', 'public.media_reference_provider_revisions', 'UPDATE')
  and not has_table_privilege('service_role', 'public.media_reference_provider_revisions', 'DELETE')
  and has_table_privilege('service_role', 'public.media_references', 'SELECT')
  and not has_table_privilege('service_role', 'public.media_references', 'INSERT')
  and not has_table_privilege('service_role', 'public.media_references', 'UPDATE')
  and not has_table_privilege('service_role', 'public.media_references', 'DELETE')
  and has_table_privilege('service_role', 'public.media_assets', 'SELECT')
  and has_table_privilege('service_role', 'public.media_assets', 'INSERT')
  and has_table_privilege('service_role', 'public.media_assets', 'UPDATE')
  and not has_table_privilege('service_role', 'public.media_assets', 'DELETE'),
  'service_role direct coordination/reference privileges are not read-only'
);
select media_coordination_test.assert_true(
  not has_table_privilege('anon', 'public.media_delete_reservations', 'SELECT')
  and not has_table_privilege('authenticated', 'public.media_reference_write_leases', 'SELECT')
  and not has_table_privilege('anon', 'public.media_reference_provider_revisions', 'SELECT'),
  'browser roles unexpectedly have direct coordination-table access'
);
select media_coordination_test.assert_true(
  has_function_privilege(
    'service_role',
    'public.acquire_media_reference_write_lease(jsonb,bigint,text,integer,text,text,text,text)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.reserve_media_asset_deletion(uuid,bigint,text,text,text,text,text,text,text,text)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.transition_media_asset_identity_for_move(uuid,uuid,text,text,text,text,text,text,text,text)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.rollback_media_asset_identity_move(uuid,uuid,text,text,text,text,text,text,text,text,text,boolean)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.finalize_media_asset_identity_move(uuid,uuid,text,text,text,text)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.get_media_reference_provider_revision(text)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.replace_media_references_for_provider(text,jsonb,uuid,bigint)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.replace_media_references_for_entity(text,text,text,jsonb,uuid,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.acquire_media_reference_write_lease(jsonb,bigint,text,integer,text,text,text,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.transition_media_asset_identity_for_move(uuid,uuid,text,text,text,text,text,text,text,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.replace_media_references_for_provider(text,jsonb,uuid,bigint)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.replace_media_references_for_entity(text,text,text,jsonb,uuid,text)',
    'EXECUTE'
  ),
  'coordination RPC execute grants are incorrect'
);

begin;
set local role service_role;
select public.assert_media_catalog_coordination_ready(
  'supabase', 'ci', 'postgres15:venesia_media_coordination_ci', 'ci-registry-v1'
);
do $$
begin
  begin
    update public.media_reference_write_leases set status = 'completed' where false;
    raise exception 'service_role_direct_lease_update_unexpectedly_allowed';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.media_delete_reservations set status = 'cancelled' where false;
    raise exception 'service_role_direct_reservation_update_unexpectedly_allowed';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.media_reference_provider_revisions set revision = revision where false;
    raise exception 'service_role_direct_provider_revision_update_unexpectedly_allowed';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.media_references set metadata = metadata where false;
    raise exception 'service_role_direct_media_reference_update_unexpectedly_allowed';
  exception when insufficient_privilege then
      null;
  end;

  begin
    delete from public.media_assets where false;
    raise exception 'service_role_direct_media_asset_delete_unexpectedly_allowed';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;
rollback;

select 'PASS media coordination PostgreSQL 17 integration assertions' as result;
