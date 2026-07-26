import { NextResponse } from "next/server";

import { requireAdminApi } from "../../../../lib/admin/auth/require-admin-api";
import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import {
  buildMediaLibraryReadModel,
  createCatalogFolder,
  getCatalogAssetById,
  getMediaCatalogRuntimeState,
  listMediaCatalogSnapshot,
  registerCatalogUpload,
  updateCatalogAssetMetadata,
} from "../../../../lib/admin/media-catalog/catalog";
import { reconcileMediaCatalog } from "../../../../lib/admin/media-catalog/reconciliation";
import { moveCatalogMediaAsset } from "../../../../lib/admin/media-catalog/physical-move";
import { safelyDeleteMediaAsset } from "../../../../lib/admin/media-catalog/safe-delete";
import { rebindAllSupportedMediaReferences } from "../../../../lib/admin/media-catalog/synchronization";
import type { MediaSmartView } from "../../../../lib/admin/media-catalog/types";
import {
  loadMediaSettings,
  mediaSettingsToUploadPolicy,
} from "../../../../lib/admin/media-catalog/settings";
import {
  deletePublicMediaAsset,
  getPublicMediaStorageError,
  listPublicMediaInventory,
  normalizeMediaFolder,
  resolveMediaStorageRuntimeContext,
  savePublicDocumentUpload,
  savePublicMediaUpload,
} from "../../../../lib/admin/media-library";
import {
  resolveCmsUploadKind,
  validateCmsUploadFile,
} from "../../../../lib/admin/media-intelligence/cms-upload-policy";
import { resolveMediaStorageProvider } from "../../../../lib/admin/media-storage-adapter";

export const maxDuration = 60;

const PRIVATE_MEDIA_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  Vary: "Cookie",
};

const SMART_VIEWS = new Set<MediaSmartView>([
  "all",
  "used",
  "unused",
  "missing_alt",
  "missing",
  "drift",
]);
const MEDIA_LIBRARY_QUERY_KEYS = new Set(["folder", "view", "kind", "page", "pageSize", "q"]);
const MEDIA_LIBRARY_PAGE_SIZES = new Set([10, 20, 30, 50, 100]);

function mediaJson(body: unknown, init?: { status?: number; headers?: HeadersInit }) {
  return NextResponse.json(body, {
    status: init?.status,
    headers: { ...PRIVATE_MEDIA_HEADERS, ...init?.headers },
  });
}

function parseBoundedInteger(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
) {
  if (value === null) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function safeError(error: unknown, fallback: string, fallbackStatus = 500) {
  const publicError = getPublicMediaStorageError(error, fallback, fallbackStatus);
  if (publicError.code !== "media_storage_error") return publicError;
  if (error instanceof Error && "code" in error && typeof error.code === "string") {
    return { message: error.message || fallback, code: error.code, status: fallbackStatus };
  }
  return publicError;
}

export async function GET(request: Request) {
  const startedAt = performance.now();
  const authError = await requireAdminApi();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const unknownQueryKey = [...searchParams.keys()].find(
      (key) => !MEDIA_LIBRARY_QUERY_KEYS.has(key),
    );
    if (unknownQueryKey) {
      return mediaJson(
        { error: `معامل البحث غير مدعوم: ${unknownQueryKey}`, code: "invalid_media_query" },
        { status: 400 },
      );
    }
    const requestedFolder = searchParams.get("folder");
    const folder = requestedFolder ? normalizeMediaFolder(requestedFolder) : null;
    const requestedSmartView = searchParams.get("view") as MediaSmartView | null;
    if (requestedSmartView && !SMART_VIEWS.has(requestedSmartView)) {
      return mediaJson(
        { error: "عرض الملفات المطلوب غير معروف.", code: "invalid_media_view" },
        { status: 400 },
      );
    }
    const smartView = requestedSmartView ?? "all";
    const kindParam = searchParams.get("kind");
    if (kindParam && kindParam !== "all" && kindParam !== "image" && kindParam !== "document") {
      return mediaJson(
        { error: "نوع الملف المطلوب غير معروف.", code: "invalid_media_kind" },
        { status: 400 },
      );
    }
    const kind: "all" | "image" | "document" = kindParam === "image" || kindParam === "document"
      ? kindParam
      : "all";
    const page = parseBoundedInteger(searchParams.get("page"), 1, 1, 100_000);
    const pageSize = parseBoundedInteger(searchParams.get("pageSize"), 20, 10, 100);
    if (page === null) {
      return mediaJson(
        { error: "رقم الصفحة غير صالح.", code: "invalid_media_page" },
        { status: 400 },
      );
    }
    if (pageSize === null || !MEDIA_LIBRARY_PAGE_SIZES.has(pageSize)) {
      return mediaJson(
        { error: "حجم الصفحة غير مدعوم.", code: "invalid_media_page_size" },
        { status: 400 },
      );
    }

    const query = searchParams.get("q") ?? "";
    if (query.length > 120) {
      return mediaJson(
        { error: "عبارة البحث أطول من الحد المسموح.", code: "invalid_media_query" },
        { status: 400 },
      );
    }
    const [catalog, inventory] = await Promise.all([
      listMediaCatalogSnapshot(),
      listPublicMediaInventory(),
    ]);
    const runtimeState = catalog.catalogState !== "unavailable"
      ? await getMediaCatalogRuntimeState().catch(() => null)
      : null;
    const result = buildMediaLibraryReadModel(catalog, inventory, {
      folder,
      query,
      kind,
      smartView,
      page,
      pageSize,
      context: resolveMediaStorageRuntimeContext(),
      runtimeState,
    });

    return mediaJson(result, {
      headers: { "Server-Timing": `media_catalog;dur=${(performance.now() - startedAt).toFixed(1)}` },
    });
  } catch (error) {
    const publicError = safeError(error, "تعذر تحميل مكتبة الوسائط.");
    return mediaJson({ error: publicError.message, code: publicError.code }, { status: publicError.status });
  }
}

export async function POST(request: Request) {
  const authError = await requireAdminApi();
  if (authError) return authError;

  try {
    const actor = await requireAdminSession();
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { operation?: unknown; folder?: unknown; displayName?: unknown; dryRun?: unknown };
      if (body.operation === "create_folder") {
        const folder = normalizeMediaFolder(String(body.folder ?? ""));
        const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 120) : "";
        const created = await createCatalogFolder(folder, actor.id, displayName);
        await recordCmsAdminAudit(
          {
            action: buildCmsAuditAction("media_folder", "create"),
            entityType: "media_folder",
            entityLabel: folder,
            metadata: { folder, displayName: displayName || null },
          },
          actor,
        );
        return mediaJson({ created: true, folder: created }, { status: 201 });
      }
      if (body.operation === "reconcile") {
        if (body.dryRun !== undefined && typeof body.dryRun !== "boolean") {
          return mediaJson(
            { error: "قيمة وضع المعاينة غير صالحة.", code: "invalid_media_dry_run" },
            { status: 400 },
          );
        }
        const result = await reconcileMediaCatalog({ dryRun: body.dryRun === true, actorId: actor.id });
        if (!result.dryRun) {
          await recordCmsAdminAudit(
            {
              action: buildCmsAuditAction("media_asset", "update"),
              entityType: "media_catalog",
              entityLabel: "reconciliation",
              metadata: {
                storageAssetCount: result.storageAssetCount,
                discoveredReferenceCount: result.discoveredReferenceCount,
                complete: result.complete,
              },
            },
            actor,
          );
        }
        return mediaJson(result);
      }
      return mediaJson({ error: "عملية Media Library غير مدعومة." }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const folder = normalizeMediaFolder(String(formData.get("folder") || "images"));
    if (!(file instanceof File) || !file.size) {
      return mediaJson({ error: "لم يتم اختيار ملف للرفع." }, { status: 400 });
    }

    const settings = await loadMediaSettings();
    const requestedKind = String(formData.get("kind") || "image");
    const uploadKind = resolveCmsUploadKind(file.name, file.type, requestedKind);
    const allowedKind = uploadKind === "pdf" ? "document" : "image";
    if (!settings.allowedKinds.includes(allowedKind)) {
      return mediaJson({ error: "هذا النوع غير مسموح من إعدادات الميديا." }, { status: 400 });
    }
    const validation = validateCmsUploadFile(file, uploadKind, mediaSettingsToUploadPolicy(settings));
    if (!validation.ok) return mediaJson({ error: validation.message }, { status: 400 });
    if (resolveMediaStorageProvider() !== "supabase") {
      return mediaJson(
        { error: "رفع Media Catalog يتطلب Supabase Storage مهيأً في هذه البيئة؛ تم منع كتابة filesystem غير مفهرسة." },
        { status: 503 },
      );
    }

    const saved =
      uploadKind === "pdf"
        ? await savePublicDocumentUpload(folder, file)
        : await savePublicMediaUpload(folder, file);

    let asset = null;
    try {
      asset = await registerCatalogUpload(saved, file, actor.id);
      if (!asset) throw new Error("media_catalog_upload_registration_required");
    } catch (error) {
      if (saved.provider === "supabase") {
        await deletePublicMediaAsset(saved.path).catch(() => undefined);
      }
      throw error;
    }

    await recordCmsAdminAudit(
      {
        action: buildCmsAuditAction("media_asset", "create"),
        entityType: "media_asset",
        entityLabel: saved.filename,
        metadata: {
          provider: saved.provider ?? "filesystem",
          bucket: saved.bucket ?? null,
          objectKey: saved.objectKey ?? saved.storagePath ?? null,
          sizeBytes: file.size,
        },
      },
      actor,
    );
    return mediaJson({ ...saved, asset }, { status: 201 });
  } catch (error) {
    const publicError = safeError(error, "تعذر تنفيذ عملية الرفع أو إنشاء المجلد.");
    return mediaJson({ error: publicError.message, code: publicError.code }, { status: publicError.status });
  }
}

export async function PATCH(request: Request) {
  const authError = await requireAdminApi();
  if (authError) return authError;

  try {
    const actor = await requireAdminSession();
    const body = (await request.json()) as Record<string, unknown>;
    if (body.operation === "update_metadata") {
      const assetId = typeof body.assetId === "string" ? body.assetId : "";
      if (!assetId) return mediaJson({ error: "معرّف الأصل مطلوب." }, { status: 400 });
      const asset = await updateCatalogAssetMetadata(assetId, {
        displayName: typeof body.displayName === "string" ? body.displayName : undefined,
        defaultAltText: typeof body.defaultAltText === "string" || body.defaultAltText === null ? body.defaultAltText : undefined,
        defaultTitle: typeof body.defaultTitle === "string" || body.defaultTitle === null ? body.defaultTitle : undefined,
        defaultCaption: typeof body.defaultCaption === "string" || body.defaultCaption === null ? body.defaultCaption : undefined,
      });
      await recordCmsAdminAudit(
        {
          action: buildCmsAuditAction("media_asset", "update"),
          entityType: "media_asset",
          entityLabel: asset.displayName,
          metadata: { assetId, operation: "metadata" },
        },
        actor,
      );
      return mediaJson({ updated: true, asset });
    }

    if (body.operation === "replace_all") {
      const previousAssetId = typeof body.previousAssetId === "string" ? body.previousAssetId : "";
      const nextAssetId = typeof body.nextAssetId === "string" ? body.nextAssetId : "";
      const [previousAsset, nextAsset] = await Promise.all([
        getCatalogAssetById(previousAssetId),
        getCatalogAssetById(nextAssetId),
      ]);
      if (!previousAsset || !nextAsset) {
        return mediaJson({ error: "تعذر العثور على الأصل القديم أو الجديد داخل الكتالوج." }, { status: 404 });
      }
      if (
        previousAsset.provider === nextAsset.provider &&
        previousAsset.bucket === nextAsset.bucket &&
        previousAsset.objectKey === nextAsset.objectKey
      ) {
        return mediaJson({ error: "لا يسمح النظام بالاستبدال إلى نفس Storage object." }, { status: 400 });
      }
      const result = await rebindAllSupportedMediaReferences(previousAsset, nextAsset, {
        actorId: actor.id,
        requestIdentity:
          request.headers.get("x-request-id")?.trim() ||
          `media-rebind:${previousAsset.id}:${nextAsset.id}`,
      });
      if (!result.ok) {
        return mediaJson(
          { error: "لم يكتمل الاستبدال؛ بقي الأصل القديم ولم يُحذف.", ...result },
          { status: result.code === "unsupported_media_references" ? 409 : 503 },
        );
      }
      await recordCmsAdminAudit(
        {
          action: buildCmsAuditAction("media_asset", "update"),
          entityType: "media_asset",
          entityLabel: previousAsset.displayName,
          metadata: {
            operation: "replace_all_supported_references",
            previousAssetId,
            nextAssetId,
            appliedCount: result.appliedCount,
            previousAssetRetained: true,
          },
        },
        actor,
      );
      return mediaJson({ replaced: true, ...result });
    }

    if (body.operation === "move_asset") {
      const assetId = typeof body.assetId === "string" ? body.assetId : "";
      const targetFolder = typeof body.targetFolder === "string" ? normalizeMediaFolder(body.targetFolder) : "";
      const targetFilename = typeof body.targetFilename === "string" ? body.targetFilename : undefined;
      const asset = await getCatalogAssetById(assetId);
      if (!asset || !targetFolder) return mediaJson({ error: "الأصل ومسار الوجهة مطلوبان." }, { status: 400 });
      const result = await moveCatalogMediaAsset(asset, { targetFolder, targetFilename }, actor.id);
      const operation = targetFolder === asset.folderPath ? "rename_physical_object" : "move_physical_object";
      await recordCmsAdminAudit(
        {
          action: buildCmsAuditAction("media_asset", "update"),
          entityType: "media_asset",
          entityLabel: asset.displayName,
          metadata: {
            operation,
            assetId,
            previousObjectKey: asset.objectKey,
            nextObjectKey: result.asset.objectKey,
          },
        },
        actor,
      );
      return mediaJson({ moved: true, operation, ...result });
    }

    return mediaJson({ error: "عملية التعديل غير مدعومة." }, { status: 400 });
  } catch (error) {
    const publicError = safeError(error, "تعذر تعديل أصل الوسائط.");
    return mediaJson({ error: publicError.message, code: publicError.code }, { status: publicError.status });
  }
}

export async function DELETE(request: Request) {
  const authError = await requireAdminApi();
  if (authError) return authError;

  try {
    const actor = await requireAdminSession();
    const body = (await request.json()) as { asset?: unknown };
    const asset = typeof body.asset === "string" ? body.asset.trim() : "";
    if (!asset) return mediaJson({ error: "حدد رابط الملف المطلوب حذفه." }, { status: 400 });

    const result = await safelyDeleteMediaAsset(asset, {
      actorId: actor.id,
      requestIdentity: request.headers.get("x-request-id") ?? undefined,
      onTransition: (transition) =>
        recordCmsAdminAudit(
          {
            action: buildCmsAuditAction("media_asset", "update"),
            entityType: "media_asset",
            entityLabel: "Media delete coordination",
            metadata: {
              operation: `media_delete_${transition.operation}`,
              assetId: transition.assetId,
              reservationId: transition.reservationId,
              failureCode: transition.failureCode ?? null,
              storageState: transition.storageState ?? null,
            },
          },
          actor,
        ),
    });
    if (!result.deleted) {
      const workflow = "workflow" in result ? result.workflow : null;
      const reservationFailureCode =
        "reservationFailureCode" in result ? result.reservationFailureCode : null;
      const status = result.eligibility.state === "unmanaged"
        ? 400
        : workflow?.repairRequired || result.eligibility.state === "uncertain"
          ? 503
          : 409;
      const message =
        workflow?.code === "media_delete_post_reservation_reference" ||
        reservationFailureCode === "media_delete_asset_in_use" ||
        result.eligibility.state === "in_use"
          ? "لا يمكن حذف الملف قبل فك جميع مراجعه الحالية."
          : workflow?.code === "media_delete_post_reservation_scan_failed"
            ? "تغيرت حالة فحص الارتباطات أثناء الحذف؛ أُلغي الحجز ولم يُحذف الملف."
            : workflow?.code === "media_delete_storage_failed" && workflow.repairRequired
              ? "تعذر إثبات نتيجة حذف الملف من التخزين. وُضع الأصل في حالة تحتاج إصلاحًا ولم يُعلن نجاح الحذف."
              : workflow?.code === "media_delete_storage_failed"
                ? "فشل حذف الملف من التخزين؛ أُلغي الحجز وعاد الأصل إلى حالته السابقة."
                : workflow?.code === "media_delete_finalization_failed"
                  ? "حُذف الملف من التخزين، لكن تعذر إنهاء سجل الحذف. الأصل يحتاج إصلاحًا ولا يمكن استخدامه."
          : result.eligibility.state === "unmanaged"
            ? "هذا الملف غير مُدار ولا يمكن حذفه عبر Media Library."
            : result.eligibility.state === "already_missing"
              ? "الملف مفقود من التخزين ويحتاج مراجعة حالته."
              : "تعذر إثبات أمان الحذف؛ تم منع العملية لحماية المحتوى.";
      const auditAsset = result.eligibility.asset;
      if (workflow && auditAsset) {
        await recordCmsAdminAudit(
          {
            action: buildCmsAuditAction("media_asset", "update"),
            entityType: "media_asset",
            entityLabel: auditAsset.displayName,
            metadata: {
              operation: "media_delete_saga_incomplete",
              assetId: auditAsset.id,
              reservationId: workflow.reservation.id,
              stage: workflow.stage,
              failureCode: workflow.code,
              recoveryState: workflow.recoveryState,
              repairRequired: workflow.repairRequired,
            },
          },
          actor,
        );
      } else if (reservationFailureCode && auditAsset) {
        await recordCmsAdminAudit(
          {
            action: buildCmsAuditAction("media_asset", "update"),
            entityType: "media_asset",
            entityLabel: auditAsset.displayName,
            metadata: {
              operation: "media_delete_reserve_blocked",
              assetId: auditAsset.id,
              failureCode: reservationFailureCode,
            },
          },
          actor,
        );
      }
      return mediaJson(
        {
          error: message,
          code:
            workflow?.code ??
            reservationFailureCode ??
            `media_delete_${result.eligibility.state}`,
          eligibility: result.eligibility,
          ...(workflow ? { workflow } : {}),
        },
        { status },
      );
    }

    await recordCmsAdminAudit(
      {
        action: buildCmsAuditAction("media_asset", "delete"),
        entityType: "media_asset",
        entityLabel: result.eligibility.asset.displayName,
        metadata: {
          assetId: result.eligibility.asset.id,
          bucket: result.eligibility.asset.bucket,
          objectKey: result.eligibility.asset.objectKey,
          reservationId: result.workflow.reservation.id,
        },
      },
      actor,
    );
    return mediaJson(result);
  } catch (error) {
    const publicError = safeError(error, "تعذر حذف الملف من التخزين الدائم.");
    return mediaJson({ error: publicError.message, code: publicError.code }, { status: publicError.status });
  }
}
