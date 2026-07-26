import "server-only";

import {
  CMS_IMAGES_BUCKET,
  verifyManagedStorageAssetExists,
} from "../../storage/upload-cms-asset";
import { getSupabaseAdmin } from "../../supabase-admin";
import { resolveMediaStorageRuntimeContext } from "../media-library";
import { getMediaCatalogRuntimeState, listCatalogReferences } from "./catalog";
import { repairCatalogAssetDeleteReservation } from "./delete-reservation";
import {
  MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION,
  scanMediaUsageByPublicValue,
} from "./reference-providers";
import {
  getMediaRecoveryFailureLabel,
  type MediaRecoveryAction,
  type MediaRecoveryItem,
  type MediaRecoveryQueue,
  type MediaRecoveryTargetKind,
} from "./recovery-contract";
import { resolveMediaReferenceWriteLease } from "./write-lease";

const RECOVERY_LIMIT = 100;
const STUCK_DELETE_MILLISECONDS = 10 * 60 * 1000;

type Row = Record<string, unknown>;

export class MediaRecoveryError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 409) {
    super(message);
    this.name = "MediaRecoveryError";
    this.code = code;
    this.status = status;
  }
}

function text(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function nullableText(value: unknown) {
  const valueText = text(value).trim();
  return valueText || null;
}

function timestamp(value: unknown) {
  const candidate = nullableText(value);
  return candidate && !Number.isNaN(Date.parse(candidate)) ? candidate : null;
}

function isMissingRecoverySchema(error: { code?: string | null; message?: string | null } | null) {
  return error?.code === "42P01" || error?.code === "PGRST205" || /does not exist/i.test(error?.message ?? "");
}

function safeFailureMetadata(value: unknown) {
  return value && typeof value === "object" ? (value as Row) : {};
}

function assetLabel(asset: Row | undefined, fallback: string) {
  return nullableText(asset?.display_name) ?? nullableText(asset?.original_filename) ?? fallback;
}

async function loadRuntimeContext() {
  const context = resolveMediaStorageRuntimeContext();
  const runtime = await getMediaCatalogRuntimeState().catch(() => null);
  return { context, runtime };
}

export async function listMediaRecoveryQueue(): Promise<MediaRecoveryQueue> {
  const generatedAt = new Date().toISOString();
  const { context, runtime } = await loadRuntimeContext();
  const emptyContext = {
    provider: context.provider ?? null,
    imageBucket: CMS_IMAGES_BUCKET,
    environment: context.environment ?? null,
    environmentIdentity: context.identity ?? null,
    registryVersion: runtime?.providerRegistryVersion ?? null,
    runtimeState: runtime?.state ?? ("uncertain" as const),
    lastSuccessfulRunIdentity:
      runtime?.lastSuccessfulReconciliationRunIdentity ?? null,
    lastSuccessfulRunAt: runtime?.lastSuccessfulReconciliationAt ?? null,
  };

  const supabase = getSupabaseAdmin();
  const expiredBefore = generatedAt;
  const [reservationsResult, assetsResult, leasesResult] = await Promise.all([
    supabase
      .from("media_delete_reservations")
      .select("id,asset_id,status,reserved_bucket,reserved_object_key,reserved_public_url,started_at,finished_at,failure_code,failure_metadata,updated_at")
      .in("status", ["reserved", "recovery_required"])
      .order("started_at", { ascending: true })
      .limit(RECOVERY_LIMIT),
    supabase
      .from("media_assets")
      .select("id,display_name,original_filename,public_url,status,reconciliation_state,missing_object,updated_at")
      .or("status.in.(deleting,missing),reconciliation_state.eq.uncertain")
      .order("updated_at", { ascending: true })
      .limit(RECOVERY_LIMIT),
    supabase
      .from("media_reference_write_leases")
      .select("id,lease_token,asset_id,domain_key,entity_type,entity_identity,status,started_at,expires_at,completed_at,resolved_at,failure_code,failure_metadata,updated_at")
      .or(`status.in.(failed,expired),and(status.eq.active,expires_at.lt.${expiredBefore})`)
      .is("resolved_at", null)
      .order("started_at", { ascending: true })
      .limit(RECOVERY_LIMIT),
  ]);

  const firstSchemaError = [reservationsResult.error, assetsResult.error, leasesResult.error]
    .find(Boolean) ?? null;
  if (firstSchemaError) {
    if (isMissingRecoverySchema(firstSchemaError)) {
      return {
        available: false,
        generatedAt,
        warning: "مركز التعافي غير متاح حتى تطبيق Migration التنسيق الجديدة على بيئة معتمدة.",
        truncated: false,
        resultLimitPerType: RECOVERY_LIMIT,
        context: emptyContext,
        counts: { stuckDeletes: 0, missingOrUncertainAssets: 0, unresolvedLeaseBatches: 0 },
        items: [],
      };
    }
    throw new MediaRecoveryError(
      "media_recovery_queue_failed",
      "تعذر تحميل حالات الميديا التي تحتاج مراجعة.",
      503,
    );
  }

  const reservations = (reservationsResult.data ?? []) as Row[];
  const troubledAssets = (assetsResult.data ?? []) as Row[];
  const leases = (leasesResult.data ?? []) as Row[];
  const assetIds = [...new Set([
    ...reservations.map((row) => text(row.asset_id)),
    ...troubledAssets.map((row) => text(row.id)),
    ...leases.map((row) => text(row.asset_id)),
  ].filter(Boolean))];

  let allAssets = troubledAssets;
  if (assetIds.length) {
    const { data, error } = await supabase
      .from("media_assets")
      .select("id,display_name,original_filename,public_url,status,reconciliation_state,missing_object,updated_at")
      .in("id", assetIds)
      .limit(RECOVERY_LIMIT * 3);
    if (error) {
      throw new MediaRecoveryError(
        "media_recovery_assets_failed",
        "تعذر تحميل الأصول المرتبطة بحالات التعافي.",
        503,
      );
    }
    allAssets = (data ?? []) as Row[];
  }
  const assetMap = new Map(allAssets.map((row) => [text(row.id), row]));
  const now = Date.now();
  const items: MediaRecoveryItem[] = [];

  for (const reservation of reservations) {
    const assetId = text(reservation.asset_id);
    const asset = assetMap.get(assetId);
    const metadata = safeFailureMetadata(reservation.failure_metadata);
    const state = text(reservation.status);
    const startedAt = timestamp(reservation.started_at);
    const stuck = state === "recovery_required"
      || (startedAt !== null && now - Date.parse(startedAt) >= STUCK_DELETE_MILLISECONDS);
    if (!stuck) continue;
    items.push({
      id: text(reservation.id),
      kind: "delete_reservation",
      state,
      assetId,
      assetCount: 1,
      assetLabel: assetLabel(asset, assetId),
      publicValue: nullableText(reservation.reserved_public_url),
      failureCode: nullableText(reservation.failure_code),
      startedAt,
      updatedAt: timestamp(reservation.updated_at),
      expiresAt: null,
      lastStorageVerification: timestamp(metadata.storageVerifiedAt),
      lastProviderScan: runtime?.lastScanAt ?? null,
      suggestedAction: getMediaRecoveryFailureLabel(nullableText(reservation.failure_code)),
      allowedActions: [
        "retry_verification",
        "preview_scoped_reconciliation",
        "retry_finalization",
        "cancel_reservation",
        "confirm_missing",
      ],
      blockedReasons: [],
    });
  }

  const reservationAssetIds = new Set(reservations.map((row) => text(row.asset_id)));
  for (const asset of troubledAssets) {
    const assetId = text(asset.id);
    if (reservationAssetIds.has(assetId)) continue;
    const assetStatus = text(asset.status);
    const reconciliationState = text(asset.reconciliation_state);
    items.push({
      id: assetId,
      kind: "asset",
      state:
        assetStatus === "active" && reconciliationState === "uncertain"
          ? reconciliationState
          : assetStatus || reconciliationState,
      assetId,
      assetCount: 1,
      assetLabel: assetLabel(asset, assetId),
      publicValue: nullableText(asset.public_url),
      failureCode: null,
      startedAt: null,
      updatedAt: timestamp(asset.updated_at),
      expiresAt: null,
      lastStorageVerification: null,
      lastProviderScan: runtime?.lastScanAt ?? null,
      suggestedAction: "أعد التحقق من التخزين والارتباطات قبل اتخاذ أي إجراء.",
      allowedActions: ["retry_verification", "preview_scoped_reconciliation"],
      blockedReasons: ["لا توجد Reservation قابلة للإصلاح لهذا الأصل."],
    });
  }

  const leaseGroups = new Map<string, Row[]>();
  for (const lease of leases) {
    const token = text(lease.lease_token);
    leaseGroups.set(token, [...(leaseGroups.get(token) ?? []), lease]);
  }
  for (const [token, group] of leaseGroups) {
    const first = group[0];
    const effectiveExpired = group.some(
      (row) => text(row.status) === "active" && Date.parse(text(row.expires_at)) <= now,
    );
    const failureAt = group
      .map((row) => timestamp(row.completed_at) ?? timestamp(row.expires_at) ?? timestamp(row.started_at))
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;
    const reconciliationNewEnough = Boolean(
      !effectiveExpired
      && runtime?.state === "synced"
      && runtime.provider === context.provider
      && runtime.environment === context.environment
      && runtime.environmentKey === context.identity
      && runtime.providerRegistryVersion === MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION
      && runtime.lastSuccessfulReconciliationRunIdentity
      && runtime.lastSuccessfulReconciliationAt
      && failureAt
      && Date.parse(runtime.lastSuccessfulReconciliationAt) > Date.parse(failureAt),
    );
    items.push({
      id: token,
      kind: "write_lease",
      state: effectiveExpired ? "expired" : text(first.status),
      assetId: text(first.asset_id) || null,
      assetCount: new Set(group.map((row) => text(row.asset_id))).size,
      assetLabel: `${assetLabel(assetMap.get(text(first.asset_id)), text(first.asset_id))}${group.length > 1 ? ` +${group.length - 1}` : ""}`,
      publicValue: nullableText(assetMap.get(text(first.asset_id))?.public_url),
      failureCode: nullableText(first.failure_code) ?? (effectiveExpired ? "media_write_lease_expired" : null),
      startedAt: timestamp(first.started_at),
      updatedAt: timestamp(first.updated_at),
      expiresAt: timestamp(first.expires_at),
      lastStorageVerification: null,
      lastProviderScan: runtime?.lastScanAt ?? null,
      suggestedAction: effectiveExpired
        ? "انتهت مهلة العملية، لكنها ما زالت نشطة ولا يمكن تجاوزها تلقائيًا."
        : reconciliationNewEnough
          ? "يمكن حل عملية الحفظ بعد إثبات المزامنة المكتملة."
          : "نفّذ فحصًا ومزامنة مكتملين قبل حل عملية الحفظ.",
      allowedActions: [
        ...(reconciliationNewEnough ? (["resolve_write_lease"] as const) : []),
      ],
      blockedReasons: effectiveExpired
        ? ["انتهاء المهلة لا يثبت توقف عملية الحفظ؛ يلزم إثبات تشغيلي قبل تغيير حالتها."]
        : reconciliationNewEnough
          ? []
          : ["لم يكتمل فحص ومزامنة أحدث من عملية الحفظ في البيئة نفسها."],
    });
  }

  return {
    available: true,
    generatedAt,
    warning: null,
    truncated:
      reservations.length >= RECOVERY_LIMIT
      || troubledAssets.length >= RECOVERY_LIMIT
      || leases.length >= RECOVERY_LIMIT,
    resultLimitPerType: RECOVERY_LIMIT,
    context: emptyContext,
    counts: {
      stuckDeletes: items.filter((item) => item.kind === "delete_reservation").length,
      missingOrUncertainAssets: troubledAssets.filter(
        (asset) => text(asset.status) === "missing" || text(asset.reconciliation_state) === "uncertain",
      ).length,
      unresolvedLeaseBatches: leaseGroups.size,
    },
    items,
  };
}

async function loadReservationAndAsset(reservationId: string) {
  const supabase = getSupabaseAdmin();
  const { data: reservation, error } = await supabase
    .from("media_delete_reservations")
    .select("id,asset_id,status,provider,reserved_bucket,reserved_object_key,reserved_public_url,updated_at")
    .eq("id", reservationId)
    .maybeSingle();
  if (error || !reservation) {
    throw new MediaRecoveryError(
      "media_recovery_reservation_not_found",
      "حالة الحذف المطلوبة غير موجودة أو تغيرت.",
      404,
    );
  }
  const { data: asset, error: assetError } = await supabase
    .from("media_assets")
    .select("id,public_url,display_name,status,updated_at")
    .eq("id", reservation.asset_id)
    .maybeSingle();
  if (assetError || !asset) {
    throw new MediaRecoveryError(
      "media_recovery_asset_not_found",
      "الأصل المرتبط بحالة الحذف غير موجود.",
      404,
    );
  }
  return { reservation: reservation as Row, asset: asset as Row };
}

async function verifyRecoveryAsset(asset: Row, reservedPublicValue?: string) {
  const publicValue = reservedPublicValue ?? text(asset.public_url);
  const [storage, persisted, live] = await Promise.all([
    verifyManagedStorageAssetExists(publicValue),
    listCatalogReferences(text(asset.id)),
    scanMediaUsageByPublicValue(publicValue),
  ]);
  if (!storage.managed) {
    throw new MediaRecoveryError("media_recovery_asset_unmanaged", "الأصل لم يعد ضمن التخزين المُدار.", 409);
  }
  return {
    storageState: storage.exists ? ("exists" as const) : ("missing" as const),
    storageVerifiedAt: new Date().toISOString(),
    persistedReferenceCount: persisted.length,
    liveReferenceCount: live.references.length,
    uncertainties: live.uncertainties,
  };
}

function assertRecoveryMutationSafe(verification: Awaited<ReturnType<typeof verifyRecoveryAsset>>) {
  if (verification.uncertainties.length) {
    throw new MediaRecoveryError(
      "media_recovery_provider_uncertain",
      "تعذر فحص جميع مواضع الارتباط؛ لم يتم تغيير الحالة.",
      503,
    );
  }
  if (verification.persistedReferenceCount || verification.liveReferenceCount) {
    throw new MediaRecoveryError(
      "media_recovery_asset_in_use",
      "ظهرت ارتباطات حالية بالملف؛ لم يتم تغيير الحالة.",
      409,
    );
  }
}

export async function executeMediaRecoveryAction(input: {
  action: MediaRecoveryAction;
  target: { kind: MediaRecoveryTargetKind; id: string; expectedUpdatedAt?: string };
}) {
  if (input.action === "resolve_write_lease") {
    if (input.target.kind !== "write_lease") {
      throw new MediaRecoveryError("invalid_media_recovery_target", "هدف عملية الحل غير صالح.", 400);
    }
    const { data, error } = await getSupabaseAdmin()
      .from("media_reference_write_leases")
      .select("lease_token,status,expires_at,completed_at,resolved_at")
      .eq("lease_token", input.target.id)
      .in("status", ["failed", "expired"])
      .is("resolved_at", null);
    if (error || !(data ?? []).length) {
      throw new MediaRecoveryError("media_write_lease_not_resolvable", "عملية الحفظ لم تعد قابلة للحل.", 409);
    }
    const runtime = await getMediaCatalogRuntimeState();
    const context = resolveMediaStorageRuntimeContext();
    const failureAt = (data ?? [])
      .map((row) => timestamp(row.completed_at) ?? timestamp(row.expires_at))
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1);
    if (
      runtime.state !== "synced"
      || runtime.providerRegistryVersion !== MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION
      || runtime.environmentKey !== context.identity
      || runtime.provider !== context.provider
      || runtime.environment !== context.environment
      || !runtime.lastSuccessfulReconciliationRunIdentity
      || !runtime.lastSuccessfulReconciliationAt
      || !failureAt
      || Date.parse(runtime.lastSuccessfulReconciliationAt) <= Date.parse(failureAt)
    ) {
      throw new MediaRecoveryError(
        "media_write_lease_reconciliation_required",
        "يلزم فحص ومزامنة ناجحان وأحدث من فشل عملية الحفظ قبل حلها.",
        409,
      );
    }
    await resolveMediaReferenceWriteLease({
      leaseToken: input.target.id,
      reconciliationRunIdentity: runtime.lastSuccessfulReconciliationRunIdentity,
      resolutionCode: "media_write_lease_reconciled_by_admin",
    });
    return { mutated: true, state: "reconciled", verification: null };
  }

  if (input.target.kind !== "delete_reservation") {
    if (input.action !== "retry_verification" && input.action !== "preview_scoped_reconciliation") {
      throw new MediaRecoveryError("invalid_media_recovery_target", "الإجراء غير متاح لهذا الأصل.", 400);
    }
    const { data: asset, error } = await getSupabaseAdmin()
      .from("media_assets")
      .select("id,public_url,display_name,status,updated_at")
      .eq("id", input.target.id)
      .maybeSingle();
    if (error || !asset) throw new MediaRecoveryError("media_recovery_asset_not_found", "الأصل غير موجود.", 404);
    const verification = await verifyRecoveryAsset(asset as Row);
    return { mutated: false, state: text(asset.status), verification };
  }

  const { reservation, asset } = await loadReservationAndAsset(input.target.id);
  if (input.target.expectedUpdatedAt && input.target.expectedUpdatedAt !== text(reservation.updated_at)) {
    throw new MediaRecoveryError(
      "media_recovery_stale_target",
      "تغيرت الحالة منذ تحميل الصفحة. حدّث القائمة قبل إعادة المحاولة.",
      409,
    );
  }
  const verification = await verifyRecoveryAsset(asset, text(reservation.reserved_public_url));
  if (input.action === "retry_verification" || input.action === "preview_scoped_reconciliation") {
    return { mutated: false, state: text(asset.status), verification };
  }
  assertRecoveryMutationSafe(verification);

  const repairAction = input.action === "cancel_reservation"
    ? "cancel"
    : input.action === "retry_finalization"
      ? "finalize"
      : "confirm_missing";
  if (repairAction === "cancel" && verification.storageState !== "exists") {
    throw new MediaRecoveryError(
      "media_delete_storage_existence_not_proven",
      "لم يثبت وجود الملف في التخزين؛ لا يمكن إعادة الأصل إلى الحالة النشطة.",
      409,
    );
  }
  if (repairAction !== "cancel" && verification.storageState !== "missing") {
    throw new MediaRecoveryError(
      "media_delete_storage_absence_not_proven",
      "الملف ما زال موجودًا في التخزين؛ لا يمكن إنهاء الحذف أو تأكيد الفقد.",
      409,
    );
  }
  const state = await repairCatalogAssetDeleteReservation({
    assetId: text(asset.id),
    reservationId: text(reservation.id),
    action: repairAction,
    storageState: verification.storageState,
    storageVerifiedAt: verification.storageVerifiedAt,
    metadata: {
      source: "admin_media_recovery_center",
      persistedReferenceCount: verification.persistedReferenceCount,
      liveReferenceCount: verification.liveReferenceCount,
    },
  });
  return { mutated: true, state, verification };
}
