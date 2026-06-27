"use client";

import { useEffect, useMemo, useState } from "react";

import { resolveAdminLinkAjax } from "../../../lib/admin/links/actions";
import { adminLinkHiddenInputNames } from "../../../lib/admin/links/form-fields";
import { emptyAdminLink, serializeAdminLink } from "../../../lib/admin/links/serialize";
import type { AdminLinkDisplay, AdminLinkValue } from "../../../lib/admin/links/types";
import { adminFormFieldClassName, adminFormHintClassName, adminFormLabelClassName } from "../VenesiaModal";
import AdminActionButton from "./AdminActionButton";
import AdminLinkPicker from "./AdminLinkPicker";

type AdminLinkFieldProps = {
  prefix: string;
  label: string;
  defaultValue?: AdminLinkValue;
  helperText?: string;
  showAnchor?: boolean;
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
  onControlledChange,
  controlledValue,
}: AdminLinkFieldProps) {
  const initial = useMemo(() => defaultValue ?? emptyAdminLink(), [defaultValue]);
  const [internalValue, setInternalValue] = useState<AdminLinkValue>(initial);
  const value = controlledValue ?? internalValue;
  const isControlled = Boolean(onControlledChange);
  const [display, setDisplay] = useState<AdminLinkDisplay | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const names = adminLinkHiddenInputNames(prefix);
  const serialized = serializeAdminLink(value);
  const previewDisplay = value.link_kind === "none" ? null : display;
  const canEditAnchor = showAnchor && supportsPageAnchor(value);

  useEffect(() => {
    if (value.link_kind === "none") return;

    let cancelled = false;
    void resolveAdminLinkAjax(value).then((response) => {
      if (cancelled) return;
      if (response.ok) setDisplay(response.display);
    });

    return () => {
      cancelled = true;
    };
  }, [value]);

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

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-[#05070B] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-white/55">{label}</p>
          {helperText ? <p className="mt-1 text-xs text-white/40">{helperText}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminActionButton variant="gold" onClick={() => setPickerOpen(true)}>
            Choose Link
          </AdminActionButton>
          {value.link_kind !== "none" ? (
            <AdminActionButton variant="ghost" onClick={() => setLink(emptyAdminLink())}>
              Clear
            </AdminActionButton>
          ) : null}
        </div>
      </div>

      {value.link_kind !== "none" ? (
        <div className="rounded-2xl border border-white/8 bg-[#080B10]/80 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#D8B87A]/12 px-2.5 py-1 text-[11px] font-semibold text-[#D8B87A]">
              {previewDisplay?.kindLabel ?? KIND_LABELS[value.link_kind]}
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold text-white">{previewDisplay?.title ?? "—"}</p>
          <p className="mt-1 truncate text-xs text-white/50" dir="ltr">
            {previewDisplay?.publicPath ?? value.href ?? "—"}
          </p>
        </div>
      ) : (
        <p className="text-sm text-white/40">لم يتم اختيار رابط بعد.</p>
      )}

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
          <span className={adminFormHintClassName()}>
            يُلحق بالرابط الداخلي، مثل: /about#team — بدون كتابة الرابط يدويًا.
          </span>
        </label>
      ) : null}

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
          onSelect={(next) => {
            setLink({
              ...next,
              anchor: supportsPageAnchor(next) ? value.anchor ?? next.anchor ?? null : next.anchor ?? null,
            });
            setPickerOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
