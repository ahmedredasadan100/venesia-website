"use client";

import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatAdminDateTime } from "../../../lib/content-dates";
import { useClientMounted } from "../../../hooks/use-client-mounted";

type ActivityProps = {
  publishedBy?: string | null;
  publishedAt?: string | null;
  updatedBy?: string | null;
  updatedAt?: string | null;
  viewsCount?: number | null;
};

type Position = { top: number; left: number };

function HistoryIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 12a8 8 0 1 0 2.35-5.65L4 8.7" />
      <path d="M4 4v4.7h4.7M12 7.5V12l3 1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function AdminContentActivityPopover({
  publishedBy,
  publishedAt,
  updatedBy,
  updatedAt,
  viewsCount,
}: ActivityProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const isMounted = useClientMounted();

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) {
      setPosition(null);
      return;
    }

    function updatePosition() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(320, window.innerWidth - 24);
      const left = Math.min(
        Math.max(12, rect.right - width),
        Math.max(12, window.innerWidth - width - 12),
      );
      const estimatedHeight = 310;
      const top =
        rect.bottom + estimatedHeight + 12 <= window.innerHeight
          ? rect.bottom + 8
          : Math.max(12, rect.top - estimatedHeight - 8);
      setPosition({ top, left });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    function close(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setIsOpen(false);
      setIsPinned(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      setIsPinned(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const panel =
    isMounted && isOpen && position
      ? createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="معلومات نشاط المحتوى"
            dir="rtl"
            style={{ position: "fixed", top: position.top, left: position.left, width: "min(320px, calc(100vw - 24px))", zIndex: 10000 }}
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => {
              if (!isPinned) setIsOpen(false);
            }}
            className="rounded-[18px] border border-[#D8B87A]/22 bg-[#080B10]/98 p-4 text-right shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          >
            <p className="mb-3 text-sm font-bold text-white">معلومات النشاط</p>
            <dl className="space-y-3">
              <ActivityLine
                label="تم النشر بواسطة:"
                value={publishedAt ? publishedBy || "غير مسجل" : "لم يُنشر بعد"}
              />
              <ActivityLine label="تاريخ النشر:" value={formatAdminDateTime(publishedAt)} />
              <ActivityLine label="تم آخر تعديل بواسطة:" value={updatedBy || "غير مسجل"} />
              <ActivityLine label="آخر تعديل:" value={formatAdminDateTime(updatedAt)} />
              <ActivityLine
                label="عدد المشاهدات:"
                value={`${new Intl.NumberFormat("ar-EG").format(viewsCount ?? 0)} مشاهدة`}
              />
            </dl>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="معلومات النشاط"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title="معلومات النشاط"
        onFocus={() => setIsOpen(true)}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => {
          if (!isPinned) setIsOpen(false);
        }}
        onClick={() => {
          setIsPinned((current) => !current);
          setIsOpen((current) => !current || !isPinned);
        }}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] border border-white/10 bg-white/[0.055] text-white/62 transition hover:border-[#D8B87A]/35 hover:text-[#D8B87A] focus:border-[#D8B87A]/45 focus:outline-none"
      >
        <HistoryIcon />
      </button>
      {panel}
    </>
  );
}

function ActivityLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2.5">
      <dt className="text-[11px] text-white/42">{label}</dt>
      <dd className="mt-1 truncate text-sm font-medium text-white/78" title={value}>
        {value}
      </dd>
    </div>
  );
}
