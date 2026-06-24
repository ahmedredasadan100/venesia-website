import Link from "next/link";

type AdminComingSoonProps = {
  eyebrow: string;
  title: string;
  description?: string;
};

export default function AdminComingSoon({ eyebrow, title, description }: AdminComingSoonProps) {
  return (
    <div className="space-y-7 pb-12">
      <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[#080B10]/90 p-8 shadow-[0_30px_100px_rgba(0,0,0,0.32)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(216,184,122,0.15),transparent_34%)]" />
        <div className="relative max-w-3xl">
          <p className="font-en text-[11px] tracking-[0.36em] text-[#D8B87A]/75">{eyebrow}</p>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] text-white md:text-5xl">{title}</h1>
          <p className="mt-5 text-sm leading-7 text-white/55">
            {description ?? "This module is already reserved in the CMS structure and will be connected to its data layer in a later implementation phase."}
          </p>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-[30px] border border-white/10 bg-[#080B10]/86 p-6">
          <p className="text-sm font-semibold text-white">Module status</p>
          <p className="mt-4 text-sm leading-7 text-white/45">Placeholder route is active. UI shell, menu state and page structure are ready.</p>
        </div>
        <div className="rounded-[30px] border border-white/10 bg-[#080B10]/86 p-6">
          <p className="text-sm font-semibold text-white">Next step</p>
          <p className="mt-4 text-sm leading-7 text-white/45">Connect schema, actions, filters and list/edit screens when this module enters the build phase.</p>
        </div>
        <div className="rounded-[30px] border border-[#D8B87A]/20 bg-[#D8B87A]/8 p-6">
          <p className="text-sm font-semibold text-[#F2D99B]">CMS rule</p>
          <p className="mt-4 text-sm leading-7 text-white/50">Reserved now. Built clean later. No rushed tables, no temporary architecture.</p>
        </div>
      </section>

      <Link href="/admin" className="inline-flex rounded-full border border-white/10 px-5 py-3 text-sm text-white/60 transition hover:border-[#D8B87A]/30 hover:text-[#F2D99B]">
        Back to Dashboard
      </Link>
    </div>
  );
}
