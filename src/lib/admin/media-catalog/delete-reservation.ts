import "server-only";

import { getSupabaseAdmin } from "../../supabase-admin";
import { resolveMediaStorageRuntimeContext } from "../media-storage-adapter";
import type { MediaDeleteReservation } from "./delete-saga";
import { MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION } from "./reference-providers";

type RpcError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
};

export class MediaDeleteReservationError extends Error {
  readonly code: string;

  constructor(code: string, message = code) {
    super(message);
    this.name = "MediaDeleteReservationError";
    this.code = code;
  }
}

function reservationErrorCode(error: RpcError | null, fallback: string) {
  const match = `${error?.message ?? ""} ${error?.details ?? ""}`.match(
    /media_(?:delete|reference)_[a-z0-9_]+/i,
  );
  return match?.[0] ?? fallback;
}

function throwReservationError(error: RpcError | null, fallback: string): never {
  const code = reservationErrorCode(error, fallback);
  throw new MediaDeleteReservationError(code);
}

function firstRpcRow(value: unknown) {
  if (Array.isArray(value)) return value[0] as Record<string, unknown> | undefined;
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

function metadataForReasons(reasons: string[]) {
  return {
    reasons: [...new Set(reasons.map((reason) => reason.trim()).filter(Boolean))].slice(0, 20),
  };
}

export async function reserveCatalogAssetDeletion(input: {
  assetId: string;
  expectedProvider: string;
  expectedBucket: string;
  expectedObjectKey: string;
  actorId?: number | null;
  requestIdentity: string;
}): Promise<MediaDeleteReservation> {
  const context = resolveMediaStorageRuntimeContext();
  if (!context.identity) {
    throw new MediaDeleteReservationError("media_catalog_environment_unproven");
  }
  const { data, error } = await getSupabaseAdmin().rpc("reserve_media_asset_deletion", {
    p_asset_id: input.assetId,
    p_actor_id: input.actorId ?? null,
    p_request_identity: input.requestIdentity,
    p_expected_asset_provider: input.expectedProvider,
    p_expected_asset_bucket: input.expectedBucket,
    p_expected_asset_object_key: input.expectedObjectKey,
    p_expected_provider: context.provider,
    p_expected_environment: context.environment,
    p_expected_environment_key: context.identity,
    p_expected_provider_registry_version: MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION,
  });
  if (error) throwReservationError(error, "media_delete_reservation_failed");

  const row = firstRpcRow(data);
  const id = typeof row?.reservation_id === "string" ? row.reservation_id : "";
  const assetId = typeof row?.reserved_asset_id === "string" ? row.reserved_asset_id : "";
  const provider = typeof row?.reserved_provider === "string" ? row.reserved_provider : "";
  const bucket = typeof row?.reserved_bucket === "string" ? row.reserved_bucket : "";
  const objectKey = typeof row?.reserved_object_key === "string" ? row.reserved_object_key : "";
  const publicValue = typeof row?.reserved_public_url === "string" ? row.reserved_public_url : "";
  const startedAt = typeof row?.started_at === "string" ? row.started_at : "";
  if (
    !id ||
    assetId !== input.assetId ||
    provider !== input.expectedProvider ||
    bucket !== input.expectedBucket ||
    objectKey !== input.expectedObjectKey ||
    !publicValue ||
    !startedAt
  ) {
    throw new MediaDeleteReservationError("media_delete_reservation_invalid_response");
  }
  return { id, assetId, publicValue, startedAt };
}

export async function cancelCatalogAssetDeletion(input: {
  reservation: MediaDeleteReservation;
  failureCode: string;
  reasons: string[];
  storageVerifiedAt: string;
}) {
  const { error } = await getSupabaseAdmin().rpc("cancel_media_asset_deletion", {
    p_asset_id: input.reservation.assetId,
    p_reservation_id: input.reservation.id,
    p_failure_code: input.failureCode,
    p_failure_metadata: metadataForReasons(input.reasons),
    p_storage_state: "exists",
    p_storage_verified_at: input.storageVerifiedAt,
  });
  if (error) throwReservationError(error, "media_delete_compensation_failed");
}

export async function finalizeCatalogAssetDeletion(input: {
  reservation: MediaDeleteReservation;
  storageVerifiedAt: string;
}) {
  const { error } = await getSupabaseAdmin().rpc("finalize_media_asset_deletion", {
    p_asset_id: input.reservation.assetId,
    p_reservation_id: input.reservation.id,
    p_storage_state: "missing",
    p_storage_verified_at: input.storageVerifiedAt,
  });
  if (error) throwReservationError(error, "media_delete_finalization_failed");
}

export async function markCatalogAssetDeleteRecovery(input: {
  reservation: MediaDeleteReservation;
  failureCode: string;
  reasons: string[];
  storageState: "missing" | "uncertain";
  storageVerifiedAt: string | null;
}) {
  const { error } = await getSupabaseAdmin().rpc("mark_media_asset_delete_recovery", {
    p_asset_id: input.reservation.assetId,
    p_reservation_id: input.reservation.id,
    p_failure_code: input.failureCode,
    p_failure_metadata: metadataForReasons(input.reasons),
    p_storage_state: input.storageState,
    p_storage_verified_at: input.storageVerifiedAt,
  });
  if (error) throwReservationError(error, "media_delete_recovery_mark_failed");
}

export async function repairCatalogAssetDeleteReservation(input: {
  assetId: string;
  reservationId: string;
  action: "cancel" | "finalize" | "confirm_missing";
  storageState: "exists" | "missing";
  storageVerifiedAt: string;
  metadata?: Record<string, unknown>;
}) {
  const { data, error } = await getSupabaseAdmin().rpc(
    "repair_media_delete_reservation",
    {
      p_asset_id: input.assetId,
      p_reservation_id: input.reservationId,
      p_action: input.action,
      p_storage_state: input.storageState,
      p_storage_verified_at: input.storageVerifiedAt,
      p_repair_metadata: input.metadata ?? {},
    },
  );
  if (error) throwReservationError(error, "media_delete_repair_failed");
  if (data !== "active" && data !== "deleted" && data !== "missing") {
    throw new MediaDeleteReservationError("media_delete_repair_invalid_response");
  }
  return data;
}
