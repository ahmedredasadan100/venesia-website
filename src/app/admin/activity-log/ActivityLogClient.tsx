"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  AdminActionButton,
  AdminDataGrid,
  AdminDataGridEmpty,
  AdminDataGridHeader,
  AdminDataGridRow,
  AdminPageHeader,
} from "../../../components/admin/ui";
import { adminFormFieldClassName } from "../../../components/admin/VenesiaModal";
import { ADMIN_LIST_PAGE } from "../../../lib/admin/admin-ui-styles";
import {
  AUDIT_ACTION_LABELS,
  type AuditAction,
} from "../../../lib/admin/audit/audit-actions";
import type { AuditLogListResult, AuditLogRecord } from "../../../lib/admin/audit/audit-types";

import { listAuditLogsAction } from "./actions";

type ActivityLogClientProps = {
  initialResult: AuditLogListResult;
  actionOptions: Array<{ value: string; label: string }>;
  actorOptions: string[];
  entityTypeOptions: string[];
  initialFilters: {
    actor: string;
    action: string;
    entityType: string;
    dateFrom: string;
    dateTo: string;
    q: string;
    page: number;
  };
};

const columns =
  "minmax(150px,1fr) minmax(120px,1fr) minmax(180px,1.2fr) minmax(120px,1fr) minmax(120px,1fr) minmax(180px,1.2fr)";

function formatDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("ar-EG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

function formatMetadata(metadata: Record<string, unknown>) {
  if (!metadata || Object.keys(metadata).length === 0) return "—";
  try {
    return JSON.stringify(metadata);
  } catch {
    return "—";
  }
}

function actionLabel(action: string) {
  return AUDIT_ACTION_LABELS[action as AuditAction] ?? action;
}

export default function ActivityLogClient({
  initialResult,
  actionOptions,
  actorOptions,
  entityTypeOptions,
  initialFilters,
}: ActivityLogClientProps) {
  const router = useRouter();
  const [result, setResult] = useState(initialResult);
  const [filters, setFilters] = useState(initialFilters);
  const [isPending, startTransition] = useTransition();

  const entityTypes = useMemo(() => {
    const merged = new Set([...entityTypeOptions, ...result.items.map((item) => item.entity_type).filter(Boolean)]);
    if (filters.entityType) merged.add(filters.entityType);
    return [...merged].sort() as string[];
  }, [entityTypeOptions, result.items, filters.entityType]);

  function applyFilters(nextPage = 1) {
    const params = new URLSearchParams();
    if (filters.actor) params.set("actor", filters.actor);
    if (filters.action) params.set("action", filters.action);
    if (filters.entityType) params.set("entityType", filters.entityType);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    if (filters.q) params.set("q", filters.q);
    if (nextPage > 1) params.set("page", String(nextPage));

    const query = params.toString();
    router.push(query ? `/admin/activity-log?${query}` : "/admin/activity-log");

    startTransition(async () => {
      const next = await listAuditLogsAction({
        actorUsername: filters.actor || undefined,
        action: filters.action || undefined,
        entityType: filters.entityType || undefined,
        dateFrom: filters.dateFrom ? `${filters.dateFrom}T00:00:00.000Z` : undefined,
        dateTo: filters.dateTo ? `${filters.dateTo}T23:59:59.999Z` : undefined,
        query: filters.q || undefined,
        page: nextPage,
        pageSize: 25,
      });
      setResult(next);
      setFilters((prev) => ({ ...prev, page: nextPage }));
    });
  }

  return (
    <div className={ADMIN_LIST_PAGE.wrapper}>
      <AdminPageHeader
        title="سجل النشاط"
        description="سجل تدقيق للعمليات الإدارية الحساسة: المصادقة وإدارة المستخدمين. لا يتم تخزين كلمات المرور أو الرموز أو ملفات تعريف الارتباط."
        meta={`${result.total} حدث`}
      />

      <section className="rounded-[28px] border border-white/10 bg-[#080B10]/78 p-4 md:p-6">
        <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <select
            value={filters.actor}
            onChange={(event) => setFilters((prev) => ({ ...prev, actor: event.target.value }))}
            className={adminFormFieldClassName()}
          >
            <option value="">كل المستخدمين</option>
            {actorOptions.map((actor) => (
              <option key={actor} value={actor}>
                {actor}
              </option>
            ))}
          </select>

          <select
            value={filters.action}
            onChange={(event) => setFilters((prev) => ({ ...prev, action: event.target.value }))}
            className={adminFormFieldClassName()}
          >
            <option value="">كل العمليات</option>
            {actionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={filters.entityType}
            onChange={(event) => setFilters((prev) => ({ ...prev, entityType: event.target.value }))}
            className={adminFormFieldClassName()}
          >
            <option value="">كل أنواع الكيانات</option>
            {entityTypes.map((entityType) => (
              <option key={entityType} value={entityType}>
                {entityType}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={filters.dateFrom}
            onChange={(event) => setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))}
            className={adminFormFieldClassName("font-en")}
          />

          <input
            type="date"
            value={filters.dateTo}
            onChange={(event) => setFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
            className={adminFormFieldClassName("font-en")}
          />

          <input
            type="search"
            value={filters.q}
            onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
            placeholder="بحث في المستخدم أو الكيان..."
            className={adminFormFieldClassName()}
          />
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          <AdminActionButton variant="primary" disabled={isPending} onClick={() => applyFilters(1)}>
            تطبيق الفلاتر
          </AdminActionButton>
          <AdminActionButton
            variant="dark"
            disabled={isPending}
            onClick={() => {
              setFilters({
                actor: "",
                action: "",
                entityType: "",
                dateFrom: "",
                dateTo: "",
                q: "",
                page: 1,
              });
              router.push("/admin/activity-log");
              startTransition(async () => {
                const next = await listAuditLogsAction({ page: 1, pageSize: 25 });
                setResult(next);
              });
            }}
          >
            إعادة ضبط
          </AdminActionButton>
        </div>

        <AdminDataGrid summary={`صفحة ${result.page} من ${result.totalPages}`}>
          <AdminDataGridHeader columns={columns}>
            <span>التاريخ</span>
            <span>المستخدم</span>
            <span>العملية</span>
            <span>نوع الكيان</span>
            <span>الكيان</span>
            <span>IP</span>
            <span>التفاصيل</span>
          </AdminDataGridHeader>

          {result.items.length === 0 ? (
            <AdminDataGridEmpty>لا توجد أحداث مطابقة للفلاتر الحالية.</AdminDataGridEmpty>
          ) : (
            result.items.map((row: AuditLogRecord) => (
              <AdminDataGridRow key={row.id} columns={columns}>
                <span className="text-white/60">{formatDate(row.created_at)}</span>
                <span className="font-semibold text-white">{row.actor_username}</span>
                <span className="text-[#D8B87A]/85">{actionLabel(row.action)}</span>
                <span className="text-white/55">{row.entity_type ?? "—"}</span>
                <span className="text-white/70">{row.entity_label ?? "—"}</span>
                <span className="font-en text-xs text-white/45">{row.ip_address ?? "—"}</span>
                <span className="truncate text-xs text-white/45" title={formatMetadata(row.metadata)}>
                  {formatMetadata(row.metadata)}
                </span>
              </AdminDataGridRow>
            ))
          )}
        </AdminDataGrid>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <AdminActionButton
            variant="dark"
            disabled={isPending || result.page <= 1}
            onClick={() => applyFilters(result.page - 1)}
          >
            السابق
          </AdminActionButton>
          <span className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-white/60">
            {result.page} / {result.totalPages}
          </span>
          <AdminActionButton
            variant="dark"
            disabled={isPending || result.page >= result.totalPages}
            onClick={() => applyFilters(result.page + 1)}
          >
            التالي
          </AdminActionButton>
        </div>
      </section>
    </div>
  );
}
