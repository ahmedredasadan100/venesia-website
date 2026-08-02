"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export type AdminSingleOpenAccordionItem = {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  content: ReactNode;
};

export type AdminSingleOpenAccordionProps = {
  items: readonly AdminSingleOpenAccordionItem[];
  defaultOpenId: string;
  ariaLabel: string;
  className?: string;
  dir?: "rtl" | "ltr";
  /** Opens the disclosure containing a requested focus target before shared navigation focuses it. */
  navigationEventName?: string;
};

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`size-4 shrink-0 transition ${open ? "rotate-180 text-[#D8B87A]" : "text-white/42"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** Shared presentation-only accordion. It owns disclosure state, never form data. */
export default function AdminSingleOpenAccordion({
  items,
  defaultOpenId,
  ariaLabel,
  className = "",
  dir = "rtl",
  navigationEventName,
}: AdminSingleOpenAccordionProps) {
  const generatedId = useId();
  const triggerRefs = useRef(new Map<string, HTMLButtonElement>());
  const [openId, setOpenId] = useState<string | null>(() =>
    items.some((item) => item.id === defaultOpenId)
      ? defaultOpenId
      : items[0]?.id ?? null,
  );
  const resolvedOpenId = openId !== null && items.some((item) => item.id === openId)
    ? openId
    : null;

  useEffect(() => {
    if (!navigationEventName) return;
    const revealTarget = (event: Event) => {
      const detail = (event as CustomEvent<{ targetId?: string }>).detail;
      const targetId = typeof detail === "object" ? detail?.targetId : undefined;
      if (!targetId) return;
      const target = document.getElementById(targetId);
      const panel = target?.closest<HTMLElement>("[data-admin-accordion-panel]");
      const itemId = panel?.dataset.adminAccordionPanel;
      if (!itemId || !items.some((item) => item.id === itemId)) return;
      setOpenId(itemId);
    };
    window.addEventListener(navigationEventName, revealTarget);
    return () => window.removeEventListener(navigationEventName, revealTarget);
  }, [items, navigationEventName]);

  function focusItem(itemId: string) {
    triggerRefs.current.get(itemId)?.focus();
  }

  function handleTriggerKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    itemId: string,
  ) {
    const index = items.findIndex((item) => item.id === itemId);
    if (index < 0 || !items.length) return;

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      focusItem(items[event.key === "Home" ? 0 : items.length - 1].id);
      return;
    }

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = (index + direction + items.length) % items.length;
    focusItem(items[nextIndex].id);
  }

  return (
    <div
      dir={dir}
      aria-label={ariaLabel}
      data-admin-single-open-accordion=""
      data-admin-single-open-accordion-active={resolvedOpenId ?? ""}
      className={`overflow-hidden rounded-2xl border border-white/10 bg-black/20 ${className}`.trim()}
    >
      {items.map((item, index) => {
        const open = item.id === resolvedOpenId;
        const triggerId = `${generatedId}-${item.id}-trigger`;
        const panelId = `${generatedId}-${item.id}-panel`;

        return (
          <section
            key={item.id}
            data-admin-accordion-item={item.id}
            className={index > 0 ? "border-t border-white/10" : undefined}
          >
            <h3>
              <button
                ref={(node) => {
                  if (node) triggerRefs.current.set(item.id, node);
                  else triggerRefs.current.delete(item.id);
                }}
                id={triggerId}
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() =>
                  setOpenId((current) => (current === item.id ? null : item.id))
                }
                onKeyDown={(event) => handleTriggerKeyDown(event, item.id)}
                className={`flex w-full cursor-pointer items-center justify-between gap-4 px-4 py-3.5 text-start text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#D8B87A]/70 ${
                  open
                    ? "bg-[#D8B87A]/[0.08] text-[#F2D99B]"
                    : "text-white/68 hover:bg-white/[0.035] hover:text-white"
                }`}
              >
                <span className="min-w-0">
                  <span className="block">{item.label}</span>
                  {item.description ? (
                    <span className={`mt-1 block text-xs font-normal leading-5 ${open ? "text-white/48" : "text-white/36"}`}>
                      {item.description}
                    </span>
                  ) : null}
                </span>
                <ChevronIcon open={open} />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={triggerId}
              hidden={!open}
              data-admin-accordion-panel={item.id}
              className="border-t border-white/10 p-4"
            >
              {item.content}
            </div>
          </section>
        );
      })}
    </div>
  );
}
