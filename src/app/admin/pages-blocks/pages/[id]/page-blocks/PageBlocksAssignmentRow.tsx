import Link from "next/link";

import {
  AdminDataGridRowActions,
  AdminDataGridActionButton,
  AdminDataGridCenterCell,
  AdminDataGridCheckbox,
  AdminDataGridCheckboxCell,
  AdminDataGridPrimaryCell,
  AdminDataGridRow,
  AdminDataGridStatusCell,
  type AdminRowActionsCapability,
} from "../../../../../../components/admin/ui";
import { moduleEditHref, moduleKindLabel } from "../../../../../../lib/page-blocks/admin-utils";
import type { PageBlockAssignmentRow } from "../../../../../../lib/page-blocks/types";

type PageBlocksAssignmentRowProps = {
  row: PageBlockAssignmentRow;
  rowId: string;
  previewHref: string | null;
  index: number;
  columns: string;
  manageable: boolean;
  isVisible: boolean;
  isSelected: boolean;
  isPending: boolean;
  onToggleSelect: (checked: boolean) => void;
  onToggleVisibility: () => void;
  onDuplicate: () => void;
  onDetach: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  manualReorderEnabled: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  showModule: boolean;
  showStatus: boolean;
};

export default function PageBlocksAssignmentRow({
  row,
  rowId,
  previewHref,
  index,
  columns,
  manageable,
  isVisible,
  isSelected,
  isPending,
  onToggleSelect,
  onToggleVisibility,
  onDuplicate,
  onDetach,
  canMoveUp,
  canMoveDown,
  manualReorderEnabled,
  onMoveUp,
  onMoveDown,
  showModule,
  showStatus,
}: PageBlocksAssignmentRowProps) {
  const hidden = { access: "hidden" as const };
  const reorderDisabledTitle =
    "أعد فرز العرض إلى الترتيب الافتراضي لاستخدام الترتيب اليدوي.";
  const capability: AdminRowActionsCapability = {
    entityType: "page_module_assignment",
    entityId: rowId,
    entityLabel: row.template_name,
    actions: {
      edit: {
        access: "allowed",
        href: moduleEditHref(row.module_kind, row.template_id),
      },
      preview: previewHref
        ? {
            access: "allowed",
            href: previewHref,
            target: "_blank",
            rel: "noopener noreferrer",
          }
        : {
            access: "disabled",
            disabledReason: "المعاينة العامة تتطلب صفحة مربوطة ومسارًا عامًا محددًا.",
          },
      information: {
        access: "allowed",
        title: `معلومات ${row.template_name}`,
        items: [
          { label: "نوع الموديول", value: moduleKindLabel(row.module_kind) },
          { label: "Slug", value: row.template_slug },
          { label: "الحالة", value: isVisible ? "ظاهر" : "مخفي" },
        ],
      },
      copyPublicLink: hidden,
      visibility: manageable
        ? {
            access: "allowed",
            isVisible,
            pending: isPending,
            onSelect: onToggleVisibility,
          }
        : hidden,
      featured: hidden,
      duplicate: manageable
        ? {
            access: "allowed",
            pending: isPending,
            onSelect: onDuplicate,
          }
        : hidden,
      archive: hidden,
      delete: manageable
        ? {
            access: "allowed",
            label: "إزالة من الصفحة",
            pending: isPending,
            onSelect: onDetach,
            confirmation: {
              mode: "shared",
              title: "تأكيد الإزالة من الصفحة",
              description: `إزالة ${moduleKindLabel(row.module_kind)} «${row.template_name}» من الصفحة؟ سيبقى القالب في المكتبة.`,
              confirmLabel: "إزالة من الصفحة",
            },
          }
        : hidden,
    },
  };

  return (
    <AdminDataGridRow
      columns={columns}
      divided={index > 0}
    >
      <AdminDataGridCheckboxCell>
        {manageable ? (
          <AdminDataGridCheckbox
            checked={isSelected}
            onChange={(event) => onToggleSelect(event.target.checked)}
            label={`تحديد ${row.template_name}`}
          />
        ) : (
          <span className="text-xs text-white/25">—</span>
        )}
      </AdminDataGridCheckboxCell>

      <AdminDataGridPrimaryCell className="flex items-center gap-2">
        <span className="flex shrink-0 gap-1">
          <AdminDataGridActionButton size="compact" title={manualReorderEnabled ? "تحريك لأعلى" : reorderDisabledTitle} disabled={!canMoveUp || isPending} pending={isPending} onClick={onMoveUp}>↑</AdminDataGridActionButton>
          <AdminDataGridActionButton size="compact" title={manualReorderEnabled ? "تحريك لأسفل" : reorderDisabledTitle} disabled={!canMoveDown || isPending} pending={isPending} onClick={onMoveDown}>↓</AdminDataGridActionButton>
        </span>
        <Link
          href={moduleEditHref(row.module_kind, row.template_id)}
          className="min-w-0 truncate text-sm font-semibold text-white hover:text-[#D8B87A]"
          title={row.template_slug}
        >
          {row.template_name}
        </Link>
        {row.module_kind !== "hero" && row.template_status !== "published" ? (
          <span className="shrink-0 rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-200/85">
            غير منشور
          </span>
        ) : null}
      </AdminDataGridPrimaryCell>

      {showModule ? (
        <AdminDataGridCenterCell className="truncate text-sm font-semibold text-white/75">
          {moduleKindLabel(row.module_kind)}
        </AdminDataGridCenterCell>
      ) : null}

      {showStatus ? (
        <AdminDataGridStatusCell>
          <AdminDataGridRowActions
            capability={capability}
            display="visibility"
            size="compact"
          />
        </AdminDataGridStatusCell>
      ) : null}

      <AdminDataGridRowActions capability={capability} size="compact" />
    </AdminDataGridRow>
  );
}
