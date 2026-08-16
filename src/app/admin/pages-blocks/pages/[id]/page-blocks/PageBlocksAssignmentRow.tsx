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
import {
  isPublishedPageBlockStatus,
  moduleEditHref,
  moduleKindLabel,
} from "../../../../../../lib/page-blocks/admin-utils";
import { LAYOUT_SLOT_LABELS_AR, normalizeLayoutSlot } from "../../../../../../lib/page-blocks/layout-slots";
import type { PageBlockAssignmentRow } from "../../../../../../lib/page-blocks/types";
import type { AdminInstantMutationRowInteraction } from "../../../../../../lib/admin/entity-list/data-engine/instant-mutation";

type PageBlocksAssignmentRowProps = {
  row: PageBlockAssignmentRow;
  rowId: string;
  previewHref: string | null;
  index: number;
  columns: string;
  manageable: boolean;
  isVisible: boolean;
  isSelected: boolean;
  interaction: AdminInstantMutationRowInteraction;
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
  interaction,
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
  const pendingAction = interaction.pendingAction;
  const templatePublished = isPublishedPageBlockStatus(row.template_status);
  const hidden = { access: "hidden" as const };
  const reorderDisabledTitle =
    "أعد فرز العرض إلى الترتيب الافتراضي لاستخدام الترتيب اليدوي.";
  const pendingState = {
    access: "disabled" as const,
    disabledReason: "انتظر انتهاء الإجراء الحالي.",
    pending: true,
  };
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
          { label: "المعرّف", value: row.template_slug },
          { label: "الموضع", value: LAYOUT_SLOT_LABELS_AR[normalizeLayoutSlot(row.slot)] },
          {
            label: "الحالة",
            value: !templatePublished
              ? "غير منشور"
              : isVisible
                ? "ظاهر"
                : "مخفي",
          },
        ],
      },
      copyPublicLink: hidden,
      visibility: !manageable
        ? hidden
        : !templatePublished
          ? {
              access: "disabled",
              disabledReason: "انشر الموديول أولًا حتى يمكن إظهاره على الصفحة.",
              isVisible: false,
            }
        : pendingAction === "visibility"
          ? { ...pendingState, isVisible }
          : {
              access: "allowed",
              isVisible,
              onSelect: onToggleVisibility,
            },
      featured: hidden,
      duplicate: !manageable
        ? hidden
        : pendingAction === "duplicate"
          ? pendingState
          : {
              access: "allowed",
              onSelect: onDuplicate,
            },
      archive: hidden,
      delete: !manageable
        ? hidden
        : pendingAction === "delete"
          ? { ...pendingState, label: "إزالة من الصفحة" }
          : {
              access: "allowed",
              label: "إزالة من الصفحة",
              onSelect: onDetach,
              confirmation: {
                mode: "shared",
                title: "تأكيد الإزالة من الصفحة",
                description: `إزالة ${moduleKindLabel(row.module_kind)} «${row.template_name}» من الصفحة؟ سيبقى القالب في المكتبة.`,
                confirmLabel: "إزالة من الصفحة",
              },
            },
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
          <AdminDataGridActionButton size="compact" title={manualReorderEnabled ? "تحريك لأعلى" : reorderDisabledTitle} disabled={!canMoveUp} pending={pendingAction === "reorder-up"} onClick={onMoveUp}>↑</AdminDataGridActionButton>
          <AdminDataGridActionButton size="compact" title={manualReorderEnabled ? "تحريك لأسفل" : reorderDisabledTitle} disabled={!canMoveDown} pending={pendingAction === "reorder-down"} onClick={onMoveDown}>↓</AdminDataGridActionButton>
        </span>
        <Link
          href={moduleEditHref(row.module_kind, row.template_id)}
          className="min-w-0 truncate text-sm font-semibold text-white hover:text-[#D8B87A]"
          title={row.template_slug}
        >
          {row.template_name}
        </Link>
        {!templatePublished ? (
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

      <AdminDataGridCenterCell className="truncate text-sm text-white/70">
        {LAYOUT_SLOT_LABELS_AR[normalizeLayoutSlot(row.slot)]}
      </AdminDataGridCenterCell>

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
