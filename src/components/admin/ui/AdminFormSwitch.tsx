import type { ChangeEventHandler, ReactNode } from "react";

export const ADMIN_FORM_SWITCH_SURFACE_CLASS_NAME =
  "rounded-xl border border-white/10 bg-black/16 px-4 py-3";

export type AdminFormSwitchProps = {
  name: string;
  label: ReactNode;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  disabled?: boolean;
  surface?: boolean;
  value?: string;
  className?: string;
  describedBy?: string;
};

export default function AdminFormSwitch({
  name,
  label,
  defaultChecked = false,
  checked,
  onChange,
  disabled = false,
  surface = false,
  value,
  className = "",
  describedBy,
}: AdminFormSwitchProps) {
  return (
    <label
      className={`flex min-w-0 cursor-pointer items-center gap-2 text-xs text-white/70 lg:whitespace-nowrap ${
        surface
          ? ADMIN_FORM_SWITCH_SURFACE_CLASS_NAME
          : "rounded-lg px-1 py-1.5"
      } ${disabled ? "cursor-not-allowed opacity-55" : ""} ${className}`.trim()}
    >
      <span className="relative inline-flex h-5 w-9 shrink-0">
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
      <span>{label}</span>
    </label>
  );
}
