import "server-only";

import { parseManagedStorageAsset } from "../../storage/upload-cms-asset";
import { getSupabaseAdmin } from "../../supabase-admin";
import { resolveMediaStorageRuntimeContext } from "../media-storage-adapter";
import {
  extractMediaCandidateValues,
  MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION,
} from "./reference-providers";

export type MediaReferenceWriteScope = {
  domainKey: string;
  entityType: string;
  entityIdentity: string;
  values: readonly unknown[];
};

export type MediaReferenceWriteTarget = {
  provider: "supabase";
  bucket: string;
  objectKey: string;
  domainKey: string;
  entityType: string;
  entityIdentity: string;
};

export type MediaReferenceWriteLease = {
  token: string;
  assetCount: number;
  startedAt: string;
  expiresAt: string;
  primaryEntityIdentity: string;
};

type RpcError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
};

export class MediaReferenceWriteLeaseError extends Error {
  readonly code: string;

  constructor(code: string, message = code) {
    super(message);
    this.name = "MediaReferenceWriteLeaseError";
    this.code = code;
  }
}

function leaseErrorCode(error: RpcError | null, fallback: string) {
  const match = `${error?.message ?? ""} ${error?.details ?? ""}`.match(
    /media_(?:write_lease|reference|catalog)[a-z0-9_]*/i,
  );
  return match?.[0] ?? fallback;
}

function throwLeaseError(error: RpcError | null, fallback: string): never {
  const code = leaseErrorCode(error, fallback);
  throw new MediaReferenceWriteLeaseError(code);
}

function firstRpcRow(value: unknown) {
  if (Array.isArray(value)) return value[0] as Record<string, unknown> | undefined;
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

export function collectManagedMediaWriteTargets(
  scopes: readonly MediaReferenceWriteScope[],
): MediaReferenceWriteTarget[] {
  const targets = new Map<string, MediaReferenceWriteTarget>();

  for (const scope of scopes) {
    const domainKey = scope.domainKey.trim();
    const entityType = scope.entityType.trim();
    const entityIdentity = scope.entityIdentity.trim();
    if (!domainKey || !entityType || !entityIdentity) {
      throw new MediaReferenceWriteLeaseError("invalid_media_write_lease_scope");
    }
    for (const value of extractMediaCandidateValues(scope.values)) {
      const managed = parseManagedStorageAsset(value);
      if (!managed) continue;
      const target: MediaReferenceWriteTarget = {
        provider: "supabase",
        bucket: managed.bucket,
        objectKey: managed.objectPath,
        domainKey,
        entityType,
        entityIdentity,
      };
      targets.set(
        [target.provider, target.bucket, target.objectKey, domainKey, entityType, entityIdentity].join("\u0000"),
        target,
      );
    }
  }

  return [...targets.values()].sort((left, right) =>
    [left.provider, left.bucket, left.objectKey, left.domainKey, left.entityType, left.entityIdentity]
      .join("\u0000")
      .localeCompare(
        [right.provider, right.bucket, right.objectKey, right.domainKey, right.entityType, right.entityIdentity]
          .join("\u0000"),
      ),
  );
}

export async function acquireMediaReferenceWriteLease(input: {
  scopes: readonly MediaReferenceWriteScope[];
  actorId?: number | null;
  requestIdentity: string;
  ttlSeconds?: number;
}): Promise<MediaReferenceWriteLease | null> {
  const targets = collectManagedMediaWriteTargets(input.scopes);
  if (!targets.length) return null;
  const context = resolveMediaStorageRuntimeContext();
  if (!context.identity) {
    throw new MediaReferenceWriteLeaseError("media_catalog_environment_unproven");
  }

  const { data, error } = await getSupabaseAdmin().rpc(
    "acquire_media_reference_write_lease",
    {
      p_targets: targets,
      p_actor_id: input.actorId ?? null,
      p_request_identity: input.requestIdentity,
      p_ttl_seconds: input.ttlSeconds ?? 180,
      p_expected_provider: context.provider,
      p_expected_environment: context.environment,
      p_expected_environment_key: context.identity,
      p_expected_provider_registry_version: MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION,
    },
  );
  if (error) throwLeaseError(error, "media_write_lease_acquisition_failed");

  const row = firstRpcRow(data);
  const token = typeof row?.lease_token === "string" ? row.lease_token : "";
  const assetCount = Number(row?.leased_asset_count ?? 0);
  const startedAt = typeof row?.lease_started_at === "string" ? row.lease_started_at : "";
  const expiresAt = typeof row?.lease_expires_at === "string" ? row.lease_expires_at : "";
  if (!token || !Number.isInteger(assetCount) || assetCount < 1 || !startedAt || !expiresAt) {
    throw new MediaReferenceWriteLeaseError("media_write_lease_invalid_response");
  }

  return {
    token,
    assetCount,
    startedAt,
    expiresAt,
    primaryEntityIdentity: targets[0].entityIdentity,
  };
}

export async function completeMediaReferenceWriteLease(
  lease: MediaReferenceWriteLease,
  entityIdentity = lease.primaryEntityIdentity,
) {
  const { data, error } = await getSupabaseAdmin().rpc(
    "complete_media_reference_write_lease",
    {
      p_lease_token: lease.token,
      p_entity_identity: entityIdentity,
    },
  );
  if (error) throwLeaseError(error, "media_write_lease_completion_failed");
  if (Number(data) !== lease.assetCount) {
    throw new MediaReferenceWriteLeaseError("media_write_lease_completion_incomplete");
  }
}

export async function failMediaReferenceWriteLease(input: {
  lease: MediaReferenceWriteLease;
  entityIdentity?: string;
  failureCode: string;
  reasons: string[];
  domainWriteCommitted: boolean;
  metadata?: Record<string, unknown>;
}) {
  const { data, error } = await getSupabaseAdmin().rpc(
    "fail_media_reference_write_lease",
    {
      p_lease_token: input.lease.token,
      p_entity_identity: input.entityIdentity ?? input.lease.primaryEntityIdentity,
      p_failure_code: input.failureCode,
      p_failure_metadata: {
        ...(input.metadata ?? {}),
        reasons: [...new Set(input.reasons.map((reason) => reason.trim()).filter(Boolean))].slice(0, 20),
      },
      p_domain_write_committed: input.domainWriteCommitted,
    },
  );
  if (error) throwLeaseError(error, "media_write_lease_failure_record_failed");
  if (Number(data) !== input.lease.assetCount) {
    throw new MediaReferenceWriteLeaseError("media_write_lease_failure_record_incomplete");
  }
}

export async function resolveMediaReferenceWriteLease(input: {
  leaseToken: string;
  reconciliationRunIdentity: string;
  resolutionCode: string;
  entityIdentity?: string | null;
}) {
  const { error } = await getSupabaseAdmin().rpc(
    "resolve_media_reference_write_lease",
    {
      p_lease_token: input.leaseToken,
      p_reconciliation_run_identity: input.reconciliationRunIdentity,
      p_resolution_code: input.resolutionCode,
      p_entity_identity: input.entityIdentity ?? null,
    },
  );
  if (error) throwLeaseError(error, "media_write_lease_resolution_failed");
}

export function getMediaReferenceWriteLeaseUserMessage(code: string) {
  if (code === "media_catalog_environment_unproven") {
    return "تعذر إثبات بيئة الميديا المتصلة. لم تُحفظ التغييرات.";
  }
  if (code === "media_write_lease_delete_reserved" || code === "media_write_lease_asset_not_active") {
    return "تعذر حفظ رابط الملف لأن الأصل دخل بالفعل في عملية حذف. حدّث الصفحة واختر ملفًا متاحًا.";
  }
  if (code === "media_write_lease_asset_missing_from_storage") {
    return "تعذر حفظ رابط الملف لأن الأصل غير موجود في مكان الحفظ.";
  }
  if (code === "media_catalog_runtime_uncertain" || code === "media_write_lease_asset_uncertain") {
    return "تعذر إثبات أمان ارتباط الملف حاليًا. لم تُحفظ التغييرات؛ أكمل فحص الميديا ثم حاول مرة أخرى.";
  }
  if (code === "media_write_lease_conflict") {
    return "توجد عملية ميديا أخرى قيد التنفيذ على الملف. لم تُحفظ التغييرات؛ حدّث الصفحة وحاول مرة أخرى.";
  }
  if (code === "media_write_lease_asset_missing") {
    return "أحد الملفات المختارة غير مسجل داخل مكتبة الميديا. لم تُحفظ التغييرات.";
  }
  return "تعذر حجز الملفات المختارة للحفظ بأمان. لم تُحفظ التغييرات.";
}
