import type { PublicProject } from "../../lib/projects/public-types";

type OverlayBreakpoint = "md" | "lg";

const hideAt: Record<OverlayBreakpoint, string> = {
  md: "md:hidden",
  lg: "lg:hidden",
};

function getCategoryLabel(category: PublicProject["category"]) {
  return category === "residential" ? "سكني" : "تجاري";
}

export function ProjectCodeBadge({
  code,
  hideFrom = "md",
}: {
  code: string;
  hideFrom?: OverlayBreakpoint;
}) {
  return (
    <span
      className={`absolute left-3 top-3 z-10 inline-flex items-center rounded-lg border border-[#D8B87A]/40 bg-[#05070B]/88 px-2.5 py-1 font-en text-sm font-semibold leading-none text-[#D8B87A] shadow-[0_4px_18px_rgba(0,0,0,0.5)] backdrop-blur-sm ${hideAt[hideFrom]}`}
    >
      {code}
    </span>
  );
}

export function ProjectImageBottomBadges({
  project,
  hideFrom = "md",
  showLocation = true,
  showType = true,
}: {
  project: PublicProject;
  hideFrom?: OverlayBreakpoint;
  showLocation?: boolean;
  showType?: boolean;
}) {
  const locationLabel = showLocation ? project.location.label : null;

  if (!locationLabel && !showType) return null;

  return (
    <div
      className={`pointer-events-none absolute inset-x-3 bottom-0 z-20 flex translate-y-1/2 flex-wrap items-center gap-1.5 ${hideAt[hideFrom]}`}
    >
      {locationLabel ? (
        <span className="inline-flex max-w-full rounded-lg bg-[#D8B87A] px-2.5 py-1 text-[11px] font-medium leading-snug text-[#111]">
          {locationLabel}
        </span>
      ) : null}

      {showType ? (
        <span className="inline-flex rounded-lg border border-[#D8B87A]/25 bg-[#D8B87A]/10 px-2.5 py-1 text-[11px] font-medium text-[#D8B87A]">
          {getCategoryLabel(project.category)}
        </span>
      ) : null}
    </div>
  );
}
