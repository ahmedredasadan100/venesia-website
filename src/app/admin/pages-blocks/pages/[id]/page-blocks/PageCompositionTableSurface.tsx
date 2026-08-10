import type { ReactNode } from "react";

type PageCompositionTableSurfaceProps = {
  feedback: ReactNode;
  toolbar: ReactNode;
  table: ReactNode;
  pagination: ReactNode;
};

/** One presentation boundary for the Page Composition toolbar and data table. */
export default function PageCompositionTableSurface({
  feedback,
  toolbar,
  table,
  pagination,
}: PageCompositionTableSurfaceProps) {
  return (
    <section className="space-y-4" dir="rtl" data-page-composition-table-surface="">
      {feedback}
      <div
        className="overflow-hidden rounded-[20px] border border-[#D8B87A]/14 bg-[#080B10]/86 shadow-[0_24px_80px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-xl"
        data-page-composition-table-frame=""
      >
        {toolbar}
        {table}
      </div>
      {pagination}
    </section>
  );
}
