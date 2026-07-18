"use client";

import { useMemo, useState } from "react";

import VenesiaModal, {
  ADMIN_FORM,
  AdminModalCancelButton,
  AdminModalPrimaryButton,
  adminFormFieldClassName,
  adminFormLabelClassName,
} from "../../../../components/admin/VenesiaModal";
import {
  ADMIN_DATA_GRID_ACTION_COLUMNS,
  AdminActionButton,
  AdminDataGrid,
  AdminDataGridActionButton,
  AdminDataGridActionsCell,
  AdminDataGridEmpty,
  AdminDataGridHeader,
  AdminDataGridRow,
  AdminStatusPill,
  AdminLinkField,
} from "../../../../components/admin/ui";
import { hasAdminLinkInContainer, linkDefaultFromContainer } from "../../../../lib/admin/links/link-defaults";
import { serializeAdminLink } from "../../../../lib/admin/links/serialize";
import type { AdminLinkValue } from "../../../../lib/admin/links/types";
import type { FooterManualLink } from "../../../../lib/footer/footer-slot-types";

const columns = `56px minmax(120px,1.1fr) minmax(160px,1.4fr) 88px 88px ${ADMIN_DATA_GRID_ACTION_COLUMNS.fiveCompact}`;

function emptyLink(sortOrder = 0): FooterManualLink {
  return { label: "", href: "", link: null, target: "_self", visible: true, sortOrder };
}

function manualLinkHrefLabel(item: FooterManualLink) {
  if (item.href?.trim()) return item.href;
  const link = item.link;
  if (link && typeof link === "object" && typeof link.href === "string" && link.href.trim()) {
    return link.href;
  }
  if (link && typeof link === "object" && link.link_kind && link.link_kind !== "none") {
    return String(link.link_kind);
  }
  return "—";
}

function sortLinks(links: FooterManualLink[]) {
  return links
    .map((link, index) => ({ link, index }))
    .sort((a, b) => (a.link.sortOrder ?? a.index) - (b.link.sortOrder ?? b.index))
    .map(({ link }) => link);
}

function reindexLinks(links: FooterManualLink[]) {
  return links.map((link, index) => ({ ...link, sortOrder: index }));
}

function moveLink(links: FooterManualLink[], fromIndex: number, direction: "up" | "down") {
  const sorted = sortLinks(links);
  const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
  if (toIndex < 0 || toIndex >= sorted.length) return links;

  const next = [...sorted];
  [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
  return reindexLinks(next);
}

type FooterLinksDataGridProps = {
  links: FooterManualLink[];
  onChange: (links: FooterManualLink[]) => void;
  addLabel?: string;
  emptyLabel?: string;
};

export default function FooterLinksDataGrid({
  links,
  onChange,
  addLabel = "+ إضافة رابط",
  emptyLabel = "لا توجد روابط بعد.",
}: FooterLinksDataGridProps) {
  const sortedLinks = useMemo(() => sortLinks(links), [links]);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<FooterManualLink>(emptyLink());

  const isCreate = editIndex === -1;
  const modalOpen = editIndex !== null;
  const draftHasLink = hasAdminLinkInContainer(draft as Record<string, unknown>);

  function openCreate() {
    setDraft(emptyLink(sortedLinks.length));
    setEditIndex(-1);
  }

  function openEdit(index: number) {
    setDraft({ ...sortedLinks[index] });
    setEditIndex(index);
  }

  function closeModal() {
    setEditIndex(null);
  }

  function updateDraftLink(link: AdminLinkValue) {
    setDraft((prev) => ({
      ...prev,
      link: serializeAdminLink(link),
      href: "",
    }));
  }

  function saveModal() {
    const label = draft.label.trim();
    if (!label || !draftHasLink) return;

    const normalized: FooterManualLink = {
      ...draft,
      label,
      href: "",
      target: draft.target === "_blank" ? "_blank" : "_self",
      visible: draft.visible !== false,
    };

    if (isCreate) {
      onChange(reindexLinks([...sortedLinks, normalized]));
    } else if (editIndex != null && editIndex >= 0) {
      onChange(reindexLinks(sortedLinks.map((item, index) => (index === editIndex ? normalized : item))));
    }

    closeModal();
  }

  function toggleVisible(index: number) {
    onChange(
      reindexLinks(
        sortedLinks.map((item, rowIndex) =>
          rowIndex === index ? { ...item, visible: item.visible === false } : item,
        ),
      ),
    );
  }

  function deleteRow(index: number) {
    if (!window.confirm("حذف هذا الرابط؟")) return;
    onChange(reindexLinks(sortedLinks.filter((_, rowIndex) => rowIndex !== index)));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-white/50">إدارة الروابط بنفس جدول البيانات المستخدم في بقية لوحة التحكم.</p>
        <AdminActionButton variant="gold" className="!min-h-10" onClick={openCreate}>
          {addLabel}
        </AdminActionButton>
      </div>

      <AdminDataGrid>
        <AdminDataGridHeader columns={columns}>
          <span className="text-center">#</span>
          <span>اسم العنصر</span>
          <span>الرابط</span>
          <span className="text-center">الهدف</span>
          <span className="text-center">الحالة</span>
          <span className="text-center">الإجراءات</span>
        </AdminDataGridHeader>

        {sortedLinks.length ? (
          sortedLinks.map((item, index) => (
            <AdminDataGridRow key={`link-${index}-${item.label}`} columns={columns}>
              <span className="text-center text-sm font-en text-white/45">{index + 1}</span>
              <span className="truncate text-sm text-white/85">{item.label || "—"}</span>
              <span className="truncate font-en text-xs text-white/45" dir="ltr">
                {manualLinkHrefLabel(item)}
              </span>
              <span className="text-center text-xs text-white/45">
                {item.target === "_blank" ? "تبويب" : "نفس"}
              </span>
              <span className="flex justify-center">
                <AdminStatusPill tone={item.visible !== false ? "green" : "muted"}>
                  {item.visible !== false ? "ظاهر" : "مخفي"}
                </AdminStatusPill>
              </span>
              <AdminDataGridActionsCell compact>
                <AdminDataGridActionButton
                  tone="dark"
                  title="تحريك لأعلى"
                  disabled={index === 0}
                  size="compact"
                  onClick={() => onChange(moveLink(sortedLinks, index, "up"))}
                >
                  <span className="text-sm">↑</span>
                </AdminDataGridActionButton>
                <AdminDataGridActionButton
                  tone="dark"
                  title="تحريك لأسفل"
                  disabled={index === sortedLinks.length - 1}
                  size="compact"
                  onClick={() => onChange(moveLink(sortedLinks, index, "down"))}
                >
                  <span className="text-sm">↓</span>
                </AdminDataGridActionButton>
                <AdminDataGridActionButton action="edit" size="compact" onClick={() => openEdit(index)} />
                <AdminDataGridActionButton
                  action="visibility"
                  size="compact"
                  isCurrentlyHidden={item.visible === false}
                  onClick={() => toggleVisible(index)}
                />
                <AdminDataGridActionButton action="delete" size="compact" onClick={() => deleteRow(index)} />
              </AdminDataGridActionsCell>
            </AdminDataGridRow>
          ))
        ) : (
          <AdminDataGridEmpty>{emptyLabel}</AdminDataGridEmpty>
        )}
      </AdminDataGrid>

      <VenesiaModal
        open={modalOpen}
        title={isCreate ? "إضافة رابط" : "تعديل رابط"}
        description="أدخل اسم العنصر واختر الرابط من النظام. يمكنك إخفاء الرابط دون حذفه."
        onClose={closeModal}
        footer={
          <>
            <AdminModalCancelButton onClick={closeModal}>إلغاء</AdminModalCancelButton>
            <AdminModalPrimaryButton onClick={saveModal} disabled={!draft.label.trim() || !draftHasLink}>
              حفظ
            </AdminModalPrimaryButton>
          </>
        }
      >
        <div className="space-y-4">
          <div className={ADMIN_FORM.gridTwoCol}>
            <label className={adminFormLabelClassName()}>
              <span>اسم العنصر</span>
              <input
                value={draft.label}
                onChange={(event) => setDraft((prev) => ({ ...prev, label: event.target.value }))}
                className={adminFormFieldClassName()}
                dir="rtl"
              />
            </label>
            <label className={adminFormLabelClassName()}>
              <span>فتح الرابط</span>
              <select
                value={draft.target ?? "_self"}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    target: event.target.value === "_blank" ? "_blank" : "_self",
                  }))
                }
                className={adminFormFieldClassName()}
              >
                <option value="_self">نفس النافذة</option>
                <option value="_blank">تبويب جديد</option>
              </select>
            </label>
            <label className={`${ADMIN_FORM.checkboxRow} md:col-span-2`}>
              <span>إظهار في الفوتر</span>
              <input
                type="checkbox"
                checked={draft.visible !== false}
                onChange={(event) => setDraft((prev) => ({ ...prev, visible: event.target.checked }))}
                className="h-4 w-4 accent-[#D8B87A]"
              />
            </label>
          </div>
          <AdminLinkField
            prefix="footer_manual_link"
            label="الرابط"
            controlledValue={linkDefaultFromContainer(draft as Record<string, unknown>)}
            onControlledChange={updateDraftLink}
          />
        </div>
      </VenesiaModal>
    </div>
  );
}
