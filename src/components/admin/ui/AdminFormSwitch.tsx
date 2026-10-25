import type { ChangeEventHandler, ReactNode } from "react";
import AdminCard from "./AdminCard";

export const ADMIN_FORM_SWITCH_SURFACE_CLASS_NAME =
  "min-h-11 rounded-xl border border-white/10 bg-black/16 px-4 py-2.5";
export const ADMIN_FORM_SWITCH_COMPACT_SURFACE_CLASS_NAME =
  "h-8 min-w-20 justify-between border border-white/10 bg-white/[0.035] px-2.5 py-1.5";

export type AdminFormSwitchProps = {
  id?: string;
  name?: string;
  label: ReactNode;
  icon?: ReactNode;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  disabled?: boolean;
  surface?: boolean;
  /** One shared Premium Card for an independent Boolean setting. */
  presentation?: "default" | "premium" | "premium-inline";
  /** The containing card owns the surface; keep the native label and control. */
  embedded?: boolean;
  /** Inline settings keep the same native checkbox and label participation. */
  embeddedLayout?: "stacked" | "inline";
  value?: string;
  /** Submitted before the checkbox so FormData.getAll(name).at(-1) is authoritative. */
  uncheckedValue?: string;
  className?: string;
  describedBy?: string;
  wrapLabel?: boolean;
};

export default function AdminFormSwitch({
  id,
  name,
  label,
  icon,
  defaultChecked = false,
  checked,
  onChange,
  disabled = false,
  surface = true,
  presentation = "default",
  embedded = false,
  embeddedLayout = "stacked",
  value,
  uncheckedValue,
  className = "",
  describedBy,
  wrapLabel = false,
}: AdminFormSwitchProps) {
  const switchControl = (
    <span className="relative inline-flex h-5 w-9 shrink-0">
      {name && uncheckedValue !== undefined ? (
        <input type="hidden" name={name} value={uncheckedValue} />
      ) : null}
      <input
        type="checkbox"
        role="switch"
        name={name}
        defaultChecked={checked === undefined ? defaultChecked : undefined}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        value={value}
        aria-describedby={describedBy}
        className="peer sr-only"
      />
      <span className="absolute inset-0 rounded-full bg-white/10 transition peer-checked:bg-[#C9972F] peer-focus-visible:ring-2 peer-focus-visible:ring-[#E2B84F]" />
      <span className="absolute start-0.5 top-0.5 size-4 rounded-full bg-white/80 shadow transition peer-checked:translate-x-4 peer-checked:bg-white rtl:peer-checked:-translate-x-4" />
    </span>
  );
  const labelContent = (
    <span className={surface || presentation === "premium" ? "min-w-0 text-start leading-5" : undefined}>
      {label}
    </span>
  );

  if (presentation === "premium-inline") {
    return (
      <AdminCard presentation="premium" className="px-2.5 py-2.5">
        <label
          id={id}
          data-admin-form-switch-surface="premium-inline"
          className={`flex min-w-0 cursor-pointer items-center gap-1 text-xs leading-5 text-white/70 ${disabled ? "cursor-not-allowed opacity-55" : ""} ${className}`.trim()}
        >
          {icon ? (
            <span aria-hidden="true" className="inline-flex size-4 shrink-0 items-center justify-center text-[#D8B87A] [&>svg]:size-4">
              {icon}
            </span>
          ) : null}
          <span className="min-w-0 flex-1 text-start leading-5">{label}</span>
          {switchControl}
        </label>
      </AdminCard>
    );
  }

  if (presentation === "premium") {
    return (
      <AdminCard presentation="premium" className="h-full p-3">
        <label
          id={id}
          data-admin-form-switch-surface="premium"
          className={`flex h-full min-w-0 cursor-pointer items-center justify-between gap-2 text-xs leading-5 text-white/70 ${disabled ? "cursor-not-allowed opacity-55" : ""} ${className}`.trim()}
        >
          {labelContent}
          {switchControl}
        </label>
      </AdminCard>
    );
  }

  if (embedded) {
    return (
      <label
        id={id}
        data-admin-form-switch-surface="embedded"
        data-admin-form-switch-layout={embeddedLayout === "inline" ? embeddedLayout : undefined}
        className={`${embeddedLayout === "inline" ? "flex min-w-0 cursor-pointer items-center justify-between gap-2" : "flex h-full min-w-0 cursor-pointer flex-col items-start justify-between gap-3"} ${disabled ? "cursor-not-allowed opacity-55" : ""} ${className}`.trim()}
      >
        {labelContent}
        <span className={embeddedLayout === "inline" ? "inline-flex shrink-0 items-center" : "inline-flex min-h-11 items-center"}>{switchControl}</span>
      </label>
    );
  }

  return (
    <label
      id={id}
      data-admin-form-switch-surface={surface ? "card" : "compact"}
      className={`${surface ? "grid grid-cols-[minmax(0,1fr)_auto] gap-3" : "inline-flex gap-2"} min-w-0 cursor-pointer items-center text-xs text-white/70 ${surface || wrapLabel ? "leading-5" : "lg:whitespace-nowrap"} ${
        surface
          ? ADMIN_FORM_SWITCH_SURFACE_CLASS_NAME
          : ADMIN_FORM_SWITCH_COMPACT_SURFACE_CLASS_NAME
      } ${disabled ? "cursor-not-allowed opacity-55" : ""} ${className}`.trim()}
    >
      {surface ? (
        <>
          {labelContent}
          {switchControl}
        </>
      ) : (
        <>
          {switchControl}
          {labelContent}
        </>
      )}
    </label>
  );
}
