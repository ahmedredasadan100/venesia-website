import "server-only";

import { getSupabaseAdmin } from "../../supabase-admin";
import { logError } from "../../logging/logger";
import { AUDIT_ACTION_LABELS, type AuditAction } from "../audit/audit-actions";
import { formatCmsAuditActionLabel } from "../audit/cms-audit-actions";
import { listAdminAuditLogs } from "../audit/list-admin-audit-logs";
import type { AuditLogRecord } from "../audit/audit-types";
import { requireAdminSession } from "../auth/require-admin-session";
import { getMediaCatalogRuntimeState } from "../media-catalog/catalog";
import { MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION } from "../media-catalog/reference-providers";
import { resolveMediaStorageRuntimeContext } from "../media-storage-adapter";
import {
  buildAdminDashboardModel,
  parseDashboardReadModel,
  type AdminDashboardModel,
  type DashboardActivity,
  type DashboardAuditReadModel,
  type DashboardMediaDiagnostics,
  type DashboardReadModel,
  type DashboardSource,
} from "./dashboard-contract";

function safeOutcome(metadata: Record<string, unknown>) {
  for (const key of ["outcome", "result", "status"] as const) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 80);
  }
  return null;
}

function auditActionLabel(action: string) {
  const cmsLabel = formatCmsAuditActionLabel(action);
  if (cmsLabel) return cmsLabel;
  if (Object.prototype.hasOwnProperty.call(AUDIT_ACTION_LABELS, action)) {
    return AUDIT_ACTION_LABELS[action as AuditAction];
  }
  return action;
}

function auditEntityLabel(event: AuditLogRecord) {
  if (event.entity_label) return event.entity_label;
  if (event.entity_type && event.entity_id != null) {
    return `${event.entity_type} #${event.entity_id}`;
  }
  return event.entity_type ?? "النظام";
}

function mapAuditEvent(event: AuditLogRecord): DashboardActivity {
  return {
    id: event.id,
    actor: event.actor_username,
    action: auditActionLabel(event.action),
    entity: auditEntityLabel(event),
    timestamp: event.created_at,
    outcome: safeOutcome(event.metadata),
  };
}

async function readDashboardTruth(): Promise<DashboardSource<DashboardReadModel>> {
  const checkedAt = new Date().toISOString();
  const { data, error } = await getSupabaseAdmin().rpc("admin_dashboard_truth_v1");
  if (error) throw new Error(error.message);

  const model = parseDashboardReadModel(data);
  const diagnostics = model.databaseDiagnostics;
  const rlsReady = Object.values(diagnostics.rls).every(Boolean);
  const provenanceReady =
    diagnostics.migrationRegistered &&
    diagnostics.rpcAclServiceOnly &&
    diagnostics.missingIndexes.length === 0 &&
    rlsReady;

  return {
    key: "read_model",
    label: "قاعدة البيانات وRead Model",
    source: diagnostics.source,
    status: provenanceReady ? "ready" : "warning",
    checkedAt,
    message: provenanceReady
      ? "قراءة ذرية ومثبتة بالـmigration والـACL والـRLS والفهارس."
      : "البيانات مقروءة، لكن فحص provenance أو الحماية أو الفهارس يحتاج مراجعة.",
    data: model,
  };
}

async function readAuditTruth(): Promise<DashboardSource<DashboardAuditReadModel>> {
  const checkedAt = new Date().toISOString();
  const result = await listAdminAuditLogs({
    page: 1,
    pageSize: 6,
    sortDirection: "desc",
  });

  return {
    key: "audit",
    label: "سجل النشاط",
    source: "admin_audit_logs via listAdminAuditLogs",
    status: "ready",
    checkedAt,
    message: result.items.length
      ? "أحدث أحداث الـAudit الموثقة."
      : "Audit متاح ولا توجد أحداث مسجلة حتى الآن.",
    data: { events: result.items.map(mapAuditEvent), total: result.total },
    href: "/admin/activity-log",
  };
}

async function readMediaDiagnostics(): Promise<DashboardSource<DashboardMediaDiagnostics>> {
  const checkedAt = new Date().toISOString();
  const [state, context] = await Promise.all([
    getMediaCatalogRuntimeState(),
    Promise.resolve(resolveMediaStorageRuntimeContext()),
  ]);
  const contextMatches =
    Boolean(context.identity) &&
    state.provider === context.provider &&
    state.environment === context.environment &&
    state.environmentKey === context.identity;
  const registryMatches =
    state.providerRegistryVersion === MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION;
  const ready =
    state.state === "synced" &&
    state.warnings.length === 0 &&
    contextMatches &&
    registryMatches;
  const lastUpdatedAt =
    state.lastSuccessfulReconciliationAt ??
    state.lastCatalogSync ??
    state.lastScanAt;

  return {
    key: "media_diagnostics",
    label: "تشخيص الميديا",
    source: "media.catalog_state via getMediaCatalogRuntimeState",
    status: ready ? "ready" : "warning",
    checkedAt,
    message: ready
      ? "حالة الميديا متزامنة مع البيئة وسجل مزودي المراجع الحالي."
      : "تشخيص الميديا متاح، لكنه لا يثبت تزامنًا كاملًا مع البيئة الحالية.",
    data: {
      state: state.state,
      provider: state.provider,
      environment: state.environment,
      lastUpdatedAt,
      storageAssetCount: state.storageAssetCount,
      catalogAssetCount: state.catalogAssetCount,
      warnings: state.warnings,
    },
    href: "/admin/settings/media",
  };
}

function unavailableSource<T>(
  key: DashboardSource<T>["key"],
  label: string,
  source: string,
  message: string,
  href?: string,
): DashboardSource<T> {
  return {
    key,
    label,
    source,
    status: "unavailable",
    checkedAt: new Date().toISOString(),
    message,
    data: null,
    href,
  };
}

export async function loadAdminDashboard(): Promise<AdminDashboardModel> {
  await requireAdminSession();
  return loadAdminDashboardSources();
}

export async function loadAdminDashboardSources(): Promise<AdminDashboardModel> {
  const checkedAt = new Date().toISOString();
  const [readResult, auditResult, mediaResult] = await Promise.allSettled([
    readDashboardTruth(),
    readAuditTruth(),
    readMediaDiagnostics(),
  ]);

  if (readResult.status === "rejected") {
    logError("Dashboard read model unavailable", readResult.reason, {
      source: "public.admin_dashboard_truth_v1()",
    });
  }
  if (auditResult.status === "rejected") {
    logError("Dashboard audit source unavailable", auditResult.reason, {
      source: "listAdminAuditLogs",
    });
  }
  if (mediaResult.status === "rejected") {
    logError("Dashboard media diagnostics unavailable", mediaResult.reason, {
      source: "getMediaCatalogRuntimeState",
    });
  }

  return buildAdminDashboardModel({
    checkedAt,
    readModel:
      readResult.status === "fulfilled"
        ? readResult.value
        : unavailableSource(
            "read_model",
            "قاعدة البيانات وRead Model",
            "public.admin_dashboard_truth_v1()",
            "تعذر تكوين أرقام أو بيانات Dashboard موثوقة. لم تُستبدل القيم بأصفار أو بيانات فارغة.",
          ),
    audit:
      auditResult.status === "fulfilled"
        ? auditResult.value
        : unavailableSource(
            "audit",
            "سجل النشاط",
            "admin_audit_logs via listAdminAuditLogs",
            "تعذر تحميل سجل النشاط الحقيقي. لم تُعرض أحداث مشتقة أو ثابتة بدلًا منه.",
            "/admin/activity-log",
          ),
    media:
      mediaResult.status === "fulfilled"
        ? mediaResult.value
        : unavailableSource(
            "media_diagnostics",
            "تشخيص الميديا",
            "media.catalog_state via getMediaCatalogRuntimeState",
            "تعذر إثبات حالة الميديا من مالك التشخيص الحالي.",
            "/admin/settings/media",
          ),
  });
}
