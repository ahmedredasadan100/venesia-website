"use client";

import { useState } from "react";
import type { FormEvent } from "react";
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
};

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
}: AdminBulkActionBarProps<T>) {
  const [selectedAction, setSelectedAction] = useState(options[0]?.value ?? "");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!onExecute) return;
    event.preventDefault();
    void onExecute(selectedAction, selectedIds);
  }
  if (!selectedIds.length) return null;

  return (
    <form
      action={action}
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-[18px] border border-[#D8B87A]/14 bg-[#080B10]/92 px-4 py-4 shadow-[0_18px_70px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.035)] md:flex-row md:items-center md:justify-between"
    >
      {Object.entries(hiddenFields ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <div className="text-sm font-bold text-white/72">
        تم تحديد <span className="font-en text-[#D8B87A]">{selectedIds.length}</span> {entityLabel}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {selectedIds.map((id) => (
          <input key={String(id)} type="hidden" name={idsFieldName} value={String(id)} />
        ))}

        <select
          name={actionFieldName}
          value={selectedAction}
          onChange={(event) => setSelectedAction(event.currentTarget.value)}
          disabled={isBusy}
          className="h-11 cursor-pointer rounded-2xl border border-white/10 bg-black/28 px-4 text-sm text-white outline-none focus:border-[#D8B87A]/45"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button
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
          className="h-11 cursor-pointer rounded-2xl border border-transparent px-4 text-sm font-semibold text-white/50 transition hover:text-white/80"
        >
          إلغاء التحديد
        </button>
      </div>
    </form>
  );
}
