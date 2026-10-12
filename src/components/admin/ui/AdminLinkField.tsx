"use client";

import { useEffect, useMemo, useState } from "react";
import { unstable_rethrow } from "next/navigation";

import { resolveAdminLinkAjax } from "../../../lib/admin/links/actions";
import { adminLinkHiddenInputNames } from "../../../lib/admin/links/form-fields";
import { emptyAdminLink, serializeAdminLink } from "../../../lib/admin/links/serialize";
import type { AdminLinkDisplay, AdminLinkValue } from "../../../lib/admin/links/types";
import { adminFormFieldClassName, adminFormLabelClassName } from "../VenesiaModal";
import AdminActionButton from "./AdminActionButton";
import AdminLinkPicker from "./AdminLinkPicker";

type AdminLinkFieldProps = {
  prefix: string;
  label: string;
  defaultValue?: AdminLinkValue;
  helperText?: string;
  showAnchor?: boolean;
  chooseLinkLabel?: string;
  clearLinkLabel?: string;
  presentation?: "card" | "inline";
  /** When set, skips hidden form inputs and uses callback state (Footer Builder, etc.). */
  onControlledChange?: (value: AdminLinkValue) => void;
  controlledValue?: AdminLinkValue;
};

const KIND_LABELS: Record<AdminLinkValue["link_kind"], string> = {
  internal: "داخلي",
  static_route: "مسار ثابت",
  external: "خارجي",
  email: "بريد",
  phone: "هاتف",
  anchor: "Anchor",
  download: "تنزيل",
  legacy: "رابط محفوظ",
  none: "بدون",
};

function supportsPageAnchor(link: AdminLinkValue) {
  return link.link_kind === "internal" || link.link_kind === "static_route";
}

export default function AdminLinkField({
  prefix,
  label,
  defaultValue,
  helperText,
  showAnchor = false,
  chooseLinkLabel = "اختيار الرابط",
  clearLinkLabel = "مسح الرابط",
  presentation = "card",
  onControlledChange,
  controlledValue,
}: AdminLinkFieldProps) {
  const initial = useMemo(() => defaultValue ?? emptyAdminLink(), [defaultValue]);
  const [internalValue, setInternalValue] = useState<AdminLinkValue>(initial);
  const value = controlledValue ?? internalValue;
  const isControlled = Boolean(onControlledChange);
  const [display, setDisplay] = useState<{ key: string; value: AdminLinkDisplay } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const names = adminLinkHiddenInputNames(prefix);
  const serialized = serializeAdminLink(value);
  const valueKey = JSON.stringify(serialized);
  const previewDisplay = value.link_kind !== "none" && display?.key === valueKey ? display.value : null;
  const canEditAnchor = showAnchor && supportsPageAnchor(value);

  useEffect(() => {
    if (value.link_kind === "none") return;
    if (display?.key === valueKey) return;

    let cancelled = false;
    void resolveAdminLinkAjax(value).then((response) => {
      if (cancelled) return;
      if (response.ok) setDisplay({ key: valueKey, value: response.display });
    }).catch((error) => {
      unstable_rethrow(error);
    });

    return () => {
      cancelled = true;
    };
  }, [value, valueKey, display]);

  function setLink(next: AdminLinkValue) {
    if (!isControlled) setInternalValue(next);
    onControlledChange?.(next);
  }

  function updateAnchor(nextAnchor: string) {
    const cleanAnchor = nextAnchor.trim().replace(/^#/, "");
    setLink({
      ...value,
      anchor: cleanAnchor || null,
    });
  }

  const fieldState = (
    <>
      {!isControlled ? (
        <>
          <input type="hidden" name={names.linkKind} value={serialized?.link_kind ?? "none"} />
          <input type="hidden" name={names.linkedType} value={serialized?.linked_type ?? ""} />
          <input type="hidden" name={names.linkedId} value={serialized?.linked_id ?? ""} />
          <input type="hidden" name={names.href} value={serialized?.href ?? ""} />
          <input type="hidden" name={names.anchor} value={serialized?.anchor ?? ""} />
          <input type="hidden" name={names.target} value={serialized?.target ?? "_self"} />
          <input type="hidden" name={names.routeKey} value={serialized?.meta?.route_key ?? ""} />
        </>
      ) : null}

      {pickerOpen ? (
        <AdminLinkPicker
          open
          initialValue={value}
          onClose={() => setPickerOpen(false)}
          onSelect={(next, selectedDisplay) => {
            const accepted = {
              ...next,
              anchor: supportsPageAnchor(next) ? value.anchor ?? next.anchor ?? null : next.anchor ?? null,
            };
            // Reuse only the exact result already resolved in this picker action.
            // A caller-owned anchor change still requires its own resolution.
            if (selectedDisplay && JSON.stringify(serializeAdminLink(accepted)) === JSON.stringify(serializeAdminLink(next))) {
              setDisplay({ key: JSON.stringify(serializeAdminLink(accepted)), value: selectedDisplay });
            }
            setLink(accepted);
            setPickerOpen(false);
          }}
        />
      ) : null}
    </>
  );

  return (
    <div data-admin-link-field={presentation} className={`min-w-0 w-full space-y-3 ${presentation === "card" ? "rounded-2xl border border-white/10 bg-[#05070B] p-3" : ""}`}>
      <div className="min-w-0 space-y-2">
        <p className="text-xs font-semibold text-white/55">{label}</p>
        {helperText ? <p className="text-xs text-white/40">{helperText}</p> : null}
        <div className="flex min-w-0 flex-wrap items-stretch gap-2">
          <AdminActionButton variant="gold" onClick={() => setPickerOpen(true)} className="min-w-0 flex-1">
            {chooseLinkLabel}
          </AdminActionButton>
          {value.link_kind !== "none" ? (
            <AdminActionButton variant="ghost" onClick={() => setLink(emptyAdminLink())}>
              {clearLinkLabel}
            </AdminActionButton>
          ) : null}
        </div>
      </div>
      <div aria-live="polite" data-admin-link-destination="" className="min-w-0 space-y-1 rounded-xl border border-white/8 bg-[#080B10]/80 px-3 py-2">
        {value.link_kind !== "none" ? <>
          <p className="break-words text-sm font-semibold text-white">{previewDisplay?.title ?? KIND_LABELS[value.link_kind]}</p>
          <p className="break-all text-xs text-white/50" dir="ltr">{previewDisplay?.publicPath ?? value.href ?? "—"}</p>
        </> : <p className="text-sm text-white/40">لم يتم اختيار رابط بعد.</p>}
      </div>
      {canEditAnchor ? (
        <label className={adminFormLabelClassName()}>
          <span>Anchor (اختياري)</span>
          <input
            value={value.anchor ?? ""}
            onChange={(event) => updateAnchor(event.target.value)}
            placeholder="team"
            dir="ltr"
            className={adminFormFieldClassName("text-left font-en")}
          />
        </label>
      ) : null}
      {fieldState}
    </div>
  );
}
