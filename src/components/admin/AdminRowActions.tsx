import Link from "next/link";
import type { ComponentType, ReactNode } from "react";

type IconProps = { className?: string };
type Tone = "gold" | "blue" | "green" | "red" | "muted";

type BaseAction = {
  label: string;
  icon: ComponentType<IconProps>;
  tone?: Tone;
  /**
   * Explicit semantic action keeps all legacy callers visually sorted
   * as: edit -> visibility -> duplicate -> delete.
   */
  actionKey?: "edit" | "visibility" | "duplicate" | "delete" | "more";
};

type LinkAction = BaseAction & {
  href: string;
};

type ButtonAction = BaseAction & {
  action?: (formData: FormData) => Promise<void>;
  fields?: Record<string, string | number | boolean | null | undefined>;
  confirmText?: string;
};

export type AdminRowAction = LinkAction | ButtonAction;

const toneClassNames: Record<Tone, string> = {
  gold: "border-[#D8B87A]/20 bg-[#D8B87A]/10 text-[#F1C668] hover:border-[#D8B87A]/45 hover:bg-[#D8B87A]/16",
  blue: "border-sky-300/18 bg-sky-500/10 text-sky-100 hover:border-sky-300/38 hover:bg-sky-500/16",
  green: "border-emerald-400/20 bg-emerald-500/14 text-emerald-100 hover:border-emerald-300/38 hover:bg-emerald-500/20",
  red: "border-red-300/15 bg-red-500/85 text-white shadow-[0_12px_30px_rgba(220,38,38,0.22)] hover:bg-red-500",
  muted: "border-white/8 bg-white/[0.075] text-white transition hover:border-[#D8B87A]/35 hover:text-[#D8B87A]",
};

export function actionClassName(tone: Tone = "muted") {
  return [
    "inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[8px] border transition",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]/35",
    toneClassNames[tone],
  ].join(" ");
}

function HiddenFields({ fields }: { fields?: ButtonAction["fields"] }) {
  if (!fields) return null;

  return Object.entries(fields).map(([key, value]) => (
    <input key={key} type="hidden" name={key} value={value == null ? "" : String(value)} />
  ));
}

export function TrashIcon({ className = "size-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M6.5 6l1 15h9l1-15" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export function PlusIcon({ className = "size-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function DownloadIcon({ className = "size-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

const actionOrder: Record<NonNullable<BaseAction["actionKey"]>, number> = {
  edit: 1,
  visibility: 2,
  duplicate: 3,
  delete: 4,
  more: 5,
};

function inferActionKey(item: AdminRowAction): NonNullable<BaseAction["actionKey"]> {
  if (item.actionKey) return item.actionKey;
  if (item.tone === "gold") return "edit";
  if (item.tone === "green") return "visibility";
  if (item.tone === "blue") return "duplicate";
  if (item.tone === "red") return "delete";
  return "more";
}

export default function AdminRowActions({ actions, children }: { actions: AdminRowAction[]; children?: ReactNode }) {
  const sortedActions = [...actions].sort((a, b) => actionOrder[inferActionKey(a)] - actionOrder[inferActionKey(b)]);

  return (
    <div dir="rtl" className="flex w-full max-w-full flex-nowrap items-center justify-center gap-2 overflow-visible">
      {sortedActions.map((item) => {
        const Icon = item.icon;

        if ("href" in item) {
          return (
            <Link key={`${item.label}-${item.href}`} href={item.href} title={item.label} aria-label={item.label} className={actionClassName(item.tone)} data-admin-ui="legacy-row-action">
              <Icon />
            </Link>
          );
        }

        return (
          <form key={item.label} action={item.action} className="inline-flex shrink-0">
            <HiddenFields fields={item.fields} />
            <button type="submit" title={item.label} aria-label={item.label} className={actionClassName(item.tone)} data-admin-ui="legacy-row-action">
              <Icon />
            </button>
          </form>
        );
      })}
      {children}
    </div>
  );
}
