import type { ReactNode } from "react";

type MediaPageShellProps = {
  children: ReactNode;
};

export default function MediaPageShell({
  children,
}: MediaPageShellProps) {
  return (
    <section className="relative py-12">
      <div className="min-w-0 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.25)] @2xl/slot-module:p-8">
        {children}
      </div>
    </section>
  );
}
