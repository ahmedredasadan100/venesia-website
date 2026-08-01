"use client";

import { useRef, useState } from "react";
import type { FormEvent, ReactNode, RefObject } from "react";
import { useFormStatus } from "react-dom";
import AdminConfirmDialog from "./AdminConfirmDialog";
import AdminListboxSelect from "./AdminListboxSelect";
import type { AdminGridId } from "./useAdminGridSelection";

type BulkOption = {
  value: string;
  label: string;
};

type AdminBulkActionBarProps<T extends AdminGridId = AdminGridId> = {
  selectedIds: T[];
  entityLabel: string;
  action?: (formData: FormData) => void | Promise<void>;
  options: BulkOption[];
  onClearSelection: () => void;
  onExecute?: (action: string, ids: T[]) => void | Promise<void>;
  isBusy?: boolean;
  actionFieldName?: string;
  idsFieldName?: string;
  hiddenFields?: Record<string, string>;
  formId?: string;
  actionControl?: ReactNode;
  additionalControls?: ReactNode;
  actionValue?: string;
};

function AdminBulkDeleteConfirm({
  open,
  count,
  entityLabel,
  busy,
  triggerRef,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  count: number;
  entityLabel: string;
  busy: boolean;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const { pending } = useFormStatus();

  return (
    <AdminConfirmDialog
      open={open}
      title={`تأكيد حذف ${entityLabel}`}
      description={`سيتم حذف ${count} ${entityLabel} من العناصر المحددة. لا يمكن التراجع عن هذا الإجراء.`}
      confirmLabel="تأكيد الحذف"
      pending={busy || pending}
      returnFocusRef={triggerRef}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

export default function AdminBulkActionBar<T extends AdminGridId = AdminGridId>({
  selectedIds,
  entityLabel,
  action,
  options,
  onClearSelection,
  onExecute,
  isBusy = false,
  actionFieldName = "bulk_action",
  idsFieldName = "ids",
  hiddenFields,
  formId,
  actionControl,
  additionalControls,
  actionValue,
}: AdminBulkActionBarProps<T>) {
  const [selectedAction, setSelectedAction] = useState(options[0]?.value ?? "");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const confirmedSubmitRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const resolvedAction = actionValue ?? selectedAction;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (confirmedSubmitRef.current) {
      confirmedSubmitRef.current = false;
      return;
    }
    if (resolvedAction === "delete") {
      event.preventDefault();
      setDeleteConfirmOpen(true);
      return;
    }
    if (!onExecute) return;
    event.preventDefault();
    void onExecute(resolvedAction, selectedIds);
  }

  async function handleConfirmedDelete() {
    if (onExecute) {
      await onExecute(resolvedAction, selectedIds);
      setDeleteConfirmOpen(false);
      return;
    }
    confirmedSubmitRef.current = true;
    formRef.current?.requestSubmit();
  }
  if (!selectedIds.length) return null;

  return (
    <form
      ref={formRef}
      id={formId}
      action={action}
      onSubmit={handleSubmit}
      data-admin-bulk-action-bar=""
      className="flex flex-col gap-4 rounded-[18px] border border-[#D8B87A]/14 bg-[#080B10]/92 px-4 py-4 shadow-[0_18px_70px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.035)] md:flex-row md:items-center md:justify-between"
    >
      {Object.entries(hiddenFields ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <input type="hidden" name={actionFieldName} value={resolvedAction} />

      <div className="text-sm font-bold text-white/72">
        تم تحديد <span className="font-en text-[#D8B87A]">{selectedIds.length}</span> {entityLabel}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {selectedIds.map((id) => (
          <input key={String(id)} type="hidden" name={idsFieldName} value={String(id)} />
        ))}

        {actionControl ?? (
          <AdminListboxSelect
            id={formId ? `${formId}-bulk-action` : undefined}
            value={selectedAction}
            onChange={setSelectedAction}
            disabled={isBusy}
            options={options}
            className="w-[180px]"
          />
        )}

        {additionalControls}

        <button
          ref={submitRef}
          type="submit"
          disabled={isBusy}
          className="h-11 cursor-pointer rounded-2xl border border-[#D8B87A]/30 bg-[#D8B87A] px-5 text-sm font-bold text-[#06101C] transition hover:bg-[#e4c88d] disabled:cursor-not-allowed disabled:opacity-55"
        >
          {isBusy ? "جار التنفيذ..." : "تنفيذ"}
        </button>

        <button
          type="button"
          onClick={onClearSelection}
          disabled={isBusy}
          className="h-11 cursor-pointer rounded-2xl border border-transparent px-4 text-sm font-semibold text-white/50 transition hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-55"
        >
          إلغاء التحديد
        </button>
      </div>

      <AdminBulkDeleteConfirm
        open={deleteConfirmOpen}
        count={selectedIds.length}
        entityLabel={entityLabel}
        busy={isBusy}
        triggerRef={submitRef}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={handleConfirmedDelete}
      />
    </form>
  );
}
