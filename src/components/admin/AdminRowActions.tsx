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

export function PencilIcon({ className = "size-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
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

export function EyeIcon({ className = "size-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function EyeOffIcon({ className = "size-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 3l18 18" />
      <path d="M10.58 10.58A2 2 0 0 0 13.42 13.42" />
      <path d="M9.88 5.15A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17.8 17.8 0 0 1-3.06 4.2" />
      <path d="M6.1 6.1C3.45 7.85 2 12 2 12s3.5 7 10 7a10.8 10.8 0 0 0 3.87-.72" />
    </svg>
  );
}

export function CopyIcon({ className = "size-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
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

export function MoreVerticalIcon({ className = "size-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
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

export function UploadIcon({ className = "size-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 21V9" />
      <path d="m7 14 5-5 5 5" />
      <path d="M5 3h14" />
    </svg>
  );
}

export function LayersIcon({ className = "size-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 16 9 5 9-5" />
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
