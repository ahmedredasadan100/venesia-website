import type { ChangeEventHandler, ReactNode } from "react";

export const ADMIN_FORM_SWITCH_SURFACE_CLASS_NAME =
  "rounded-xl border border-white/10 bg-black/16 px-4 py-3";

export type AdminFormSwitchProps = {
  id?: string;
  name?: string;
  label: ReactNode;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  disabled?: boolean;
  surface?: boolean;
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
  defaultChecked = false,
  checked,
  onChange,
  disabled = false,
  surface = false,
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
    <span className={surface ? "min-w-0 text-start leading-5" : undefined}>
      {label}
    </span>
  );

  return (
    <label
      id={id}
      className={`${surface ? "grid grid-cols-[minmax(0,1fr)_auto] gap-3" : "inline-flex gap-2"} min-w-0 cursor-pointer items-center text-xs text-white/70 ${surface || wrapLabel ? "leading-5" : "lg:whitespace-nowrap"} ${
        surface
          ? ADMIN_FORM_SWITCH_SURFACE_CLASS_NAME
          : "rounded-lg px-1 py-1.5"
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
