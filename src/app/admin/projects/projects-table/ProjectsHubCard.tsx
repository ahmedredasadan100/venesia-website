"use client";

import Link from "next/link";

import { AdminCard } from "../../../../components/admin/ui";
import AdminStatusPill from "../../../../components/admin/ui/AdminStatusPill";

type ProjectsHubCardProps = {
  href: string;
  emoji: string;
  title: string;
  description: string;
  count: number;
};

export default function ProjectsHubCard({
  href,
  emoji,
  title,
  description,
  count,
}: ProjectsHubCardProps) {
  return (
    <Link href={href} className="block h-full">
      <AdminCard interactive className="group h-full p-6">
        <div className="flex items-start justify-between gap-4">
          <span className="text-3xl">{emoji}</span>
          <AdminStatusPill tone="green">{count} مشروع</AdminStatusPill>
        </div>
        <h2 className="mt-5 text-2xl font-semibold text-white">{title}</h2>
        <p className="mt-4 min-h-[72px] text-sm leading-7 text-white/52">{description}</p>
        <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#D8B87A]">
          فتح المدير
          <span aria-hidden="true">←</span>
        </div>
      </AdminCard>
    </Link>
  );
}
